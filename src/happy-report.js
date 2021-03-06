/**
 * HappyPerformance
 */
function HappyPerformance(clientOptions, fn) {
  try {
    let options = {
      // 上报地址
      domain: '',
      // 脚本延迟上报时间
      outtime: 1000,
      // ajax请求时需要过滤的url信息
      filterUrl: ['http://localhost:35729/livereload.js?snipver=1'],
      // 是否上报页面性能数据
      isPage: true,
      // 是否上报页面资源数据
      isResource: true,
      // 是否上报错误信息
      isError: true,
    }

    options = Object.assign(options, clientOptions)

    let config = {
      //资源列表 
      resourceList: [],
      // 页面性能列表
      performance: {},
      // 错误列表
      errorList: [],
      // 页面fetch数量
      fetchNum: 0,
      // ajax onload数量
      loadNum: 0,
      // 页面ajax数量
      ajaxLength: 0,
      // 页面fetch总数量
      fetLength: 0,
      // 页面ajax信息
      ajaxMsg: [],
      // ajax成功执行函数
      goingType: '',
      // 是否有ajax
      haveAjax: false,
      // 是否有fetch
      haveFetch: false,
      // 来自域名
      preUrl: document.referrer && document.referrer !== location.href ? document.referrer : '',
      // 浏览器信息
      appVersion: navigator.appVersion,
      // 当前页面
      page: location.href,
      // 用户动作
      actionList: []
    }

    /**
     * 默认的错误配置
     */
    let errorDefault = {
      time: '',
      resource: 'js',
      msg: '',
      data: {}
    };

    let beginTime = new Date().getTime()
    let loadTime = 0
    let ajaxTime = 0
    let fetchTime = 0

    // error上报
    if (options.isError){
        _error()
    } 

    // 监听页面的元素被用户点击
    document.addEventListener("click", function (e) {
      console.log(e)
      const XPath = getXPath(e.target)
      config.actionList.push(XPath)
      reportActionData(XPath, e)
    }, false)

    // 监听页面load事件
    window.addEventListener("load", function () {
      loadTime = new Date().getTime() - beginTime
      getLargeTime()
    }, false)

    // 监听页面beforeunload事件
    window.addEventListener('beforeunload', function(e){
      const isInViewportElementList = sessionStorage.getItem('in_view_port_element_list')
      const arr = isInViewportElementList.split(',')
      reportLeaveActionData(arr[arr.length - 1])
      sessionStorage.removeItem('in_view_port_element_list')
    })

    // 监听页面滚动
    sessionStorage.setItem('in_view_port_element_list', [])
    const sessionIsInViewportElementList = sessionStorage.getItem('in_view_port_element_list') || []
    window.addEventListener('scroll', throttle(function(e) {
      const moduleList = document.querySelectorAll('[data-module-id]')
      const arr = Array.from(moduleList)
      arr.map((item, index) => {
        if (isElementInViewport(item)) {
          const moduleId = item.getAttribute('data-module-id')
          sessionIsInViewportElementList.push(moduleId)
        }
      })
      sessionStorage.setItem('in_view_port_element_list', sessionIsInViewportElementList)
      handleReportVistorLog()
    }, 500))

    // 执行fetch重写
    if (options.isResource || options.isError){
      _fetch()
    } 

    //  拦截ajax
    if (options.isResource || options.isError){
        _Ajax({
          onreadystatechange: function (xhr) {
            if (xhr.readyState === 4) {
              setTimeout(() => {
                if (config.goingType === 'load') return;
                config.goingType = 'readychange';

                getAjaxTime('readychange')

                if (xhr.status < 200 || xhr.status > 300) {
                  xhr.method = xhr.args.method
                  ajaxResponse(xhr)
                }
              }, 600)
            }
          },
          onerror: function (xhr) {
            // console.log(xhr)
            getAjaxTime('error')
            if (xhr.args) {
              xhr.method = xhr.args.method
              xhr.responseURL = xhr.args.url
              xhr.statusText = 'ajax request error'
            }
            ajaxResponse(xhr)
          },
          onload: function (xhr) {
            if (xhr.readyState === 4) {
              if (config.goingType === 'readychange') return;
              config.goingType = 'load';
              getAjaxTime('load');
              if (xhr.status < 200 || xhr.status > 300) {
                xhr.method = xhr.args.method
                ajaxResponse(xhr)
              }
            }
          },
          open: function (arg, xhr) {
            if (options.filterUrl && options.filterUrl.length) {
              let begin = false;
              options.filterUrl.forEach(item => {
                if (arg[1].indexOf(item) != -1) begin = true;
              })
              if (begin) return;
            }

            let result = {
              url: arg[1],
              method: arg[0] || 'GET',
              type: 'xmlhttprequest'
            }
            this.args = result

            clearPerformance()
            config.ajaxMsg.push(result)
            config.ajaxLength = config.ajaxLength + 1;
            config.haveAjax = true
          }
        })
    } 

    /**
     * 判断元素是否在可视区域
     */
    function isElementInViewport(el) {
      var rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
        (window.innerWidth || document.documentElement.clientWidth)
      )
    }

    /**
     * 节流
     */
    function throttle(func, delay) {            
      let prev = Date.now();            
      return function() {                
        let context = this             
        let args = arguments
        let now = Date.now()                
        if (now - prev >= delay) {                    
          func.apply(context, args)
          prev = Date.now()         
        }            
      }        
    } 

    /**
     * 处理上报日志
     */
    function handleReportVistorLog() {
      const docHeight = document.body.clientHeight
      const winHeight = getScrollY() + window.innerHeight
      const moduleList = document.querySelectorAll('[data-module-id]')
      const arr = Array.from(moduleList)
      arr.map((item, index) => {
        let isReport = false
        if (moduleList.length > 0 ) {
          isReport = winHeight < arr[index].offsetTop * 1 ? false : true
        } else {
          isReport = winHeight < docHeight * 1 ? false : true
        }
        if (isReport) {
          reportLeaveActionData(arr[index].getAttribute('data-module-id'), true)
        }
      })
    }

    /**
     * 获取滚动的时候的Y坐标
     */
    function getScrollY() {
      let scrOfY = 0
      if (typeof(window.pageYOffset) == "number") {
        scrOfY = window.pageYOffset
      } else if (document.body && (document.body.scrollLeft || document.body.scrollTop)) {
        scrOfY = document.body.scrollTop
      } else if (document.documentElement && (document.documentElement.scrollLeft || document.documentElement.scrollTop)) {
        scrOfY = document.documentElement.scrollTop
      }
      return scrOfY
    }

    /**
     * 生成随机数
     */
    function randomString(len) {
      len = len || 10;
      var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz123456789';
      var maxPos = $chars.length;
      var pwd = '';
      for (let i = 0; i < len; i++) {
          pwd = pwd + $chars.charAt(Math.floor(Math.random() * maxPos));
      }
      return pwd + new Date().getTime();
    }

    /**
     * 获得markpage
     */
    function getMarkUser() {
      let markUser = sessionStorage.getItem('ps_markUser') || '';
      let result = {
          markUser: markUser,
          isFristIn: false,
      };
      if (!markUser) {
          markUser = randomString();
          sessionStorage.setItem('ps_markUser', markUser);
          result.markUser = markUser;
          result.isFristIn = true;
      }
      return result;
    }

    /**
     * 汇报信息
     */
    function reportData() {
      setTimeout(() => {
        const markuser = getMarkUser()
        if (options.isPage) perforPage()
        if (options.isResource) perforResource()
        if (ERRORLIST && ERRORLIST.length) config.errorList = config.errorList.concat(ERRORLIST)
        let result = {
          markUser: markuser.markUser,
          isFristIn: markuser.isFristIn,
          time: new Date().getTime(),
          page: config.page,
          preUrl: config.preUrl,
          appVersion: config.appVersion,
          errorList: config.errorList,
          performance: config.performance,
          resourceList: config.resourceList,
          otherData: OTHERDATA,
          actionList: config.actionList,
          type: 'resource'
        }
        console.log(JSON.stringify(result))
        fn && fn(result)
        if (!fn && window.fetch) {
          fetch(options.domain, {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            type: 'report-data',
            body: JSON.stringify(result),
          }).then(() => {
            clear()
            clearPerformance()
          })
        }
      }, options.outtime)
    }

    /**
     * 汇报客户离开的时候的动作
     */
    function reportLeaveActionData(moduleId, isScroll) {
      setTimeout(() => {
        const markuser = getMarkUser()
        if (options.isPage) perforPage()
        if (options.isResource) perforResource()
        let result = {
          markUser: markuser.markUser,
          isFristIn: markuser.isFristIn,
          time: new Date().getTime(),
          appVersion: config.appVersion,
          otherData: OTHERDATA,
          event: {
            page: config.page,
            moduleId: moduleId,
            params: {
              preUrl: config.preUrl
            }
          },
          type: isScroll ? 'scroll-action' : 'leave-action'
        }
        console.log(JSON.stringify(result))
        fn && fn(result)
        if (!fn && window.fetch) {
          fetch(options.domain, {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            type: 'report-leave-data',
            body: JSON.stringify(result),
          })
        }
      }, 0)
    }

    /**
     * 汇报客户动作
     */
    function reportActionData(xpath, e){
      setTimeout(() => {
        const markuser = getMarkUser()
        if (options.isPage) perforPage()
        if (options.isResource) perforResource()
        let result = {
          markUser: markuser.markUser,
          isFristIn: markuser.isFristIn,
          time: new Date().getTime(),
          appVersion: config.appVersion,
          otherData: OTHERDATA,
          event: {
            page: config.page,
            xpath: xpath,
            moduleId: getDomAttribute(e, 'data-module-id'),
            params: {
              title: getDomTxt(e),
              preUrl: config.preUrl,
              itemType: getDomType(e)
            }
          },
          type: 'action'
        }
        console.log(JSON.stringify(result))
        fn && fn(result)
        if (!fn && window.fetch) {
          fetch(options.domain, {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            type: 'report-action-data',
            body: JSON.stringify(result)
          })
        }
      }, 0)
    }

    /**
     *  获取dom属性 
     */
    function getDomAttribute(e, attribute) {
      const obj = e.target || e.srcElement
      return obj.getAttribute(attribute) || ''
    }

    /**
     * 获取Dom类型
     */
    function getDomType(e){
      const obj = e.target || e.srcElement
      return obj.nodeName.toLocaleLowerCase() || '' 
    }

    /**
     * 获取dom的文本
     */
    function getDomTxt(e){
      const obj = e.target || e.srcElement
      const nodeName = obj.nodeName.toLocaleLowerCase() || '' 
      if ('body' !== nodeName && 'html' !== nodeName && '' !== nodeName) {
        return obj.innerText || obj.value
      }else {
        return handlBodyClickTxt(obj.innerText || obj.value)
      }
    }

    /**
     * 处理如果点击页面后，处理获取的文字
     */
    function handlBodyClickTxt() {
      let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "";
      return e.length > 30 && (e = e.slice(0, 15) + "..." + e.slice(e.length - 15)), e
    }

    /**
     * 比较onload与ajax时间长度
     */
    function getLargeTime() {
      // console.log('====================================');
      // console.log(config.haveAjax, config.haveFetch, loadTime, ajaxTime, fetchTime);
      // console.log('====================================');
      if (config.haveAjax && config.haveFetch && loadTime && ajaxTime && fetchTime) {
        console.log(`loadTime:${loadTime},ajaxTime:${ajaxTime},fetchTime:${fetchTime}`)
        reportData()
      } else if (config.haveAjax && !config.haveFetch && loadTime && ajaxTime) {
        console.log(`loadTime:${loadTime},ajaxTime:${ajaxTime}`)
        reportData()
      } else if (!config.haveAjax && config.haveFetch && loadTime && fetchTime) {
        console.log(`loadTime:${loadTime},fetchTime:${fetchTime}`)
        reportData()
      } else if (!config.haveAjax && !config.haveFetch && loadTime) {
        console.log(`loadTime:${loadTime}`)
        reportData()
      }
    }

    /**
     * 统计页面性能
     */
    function perforPage() {
      if (!window.performance) return;
      let timing = performance.timing
      config.performance = {
        // DNS解析时间
        dnst: timing.domainLookupEnd - timing.domainLookupStart || 0,
        // TCP建立时间
        tcpt: timing.connectEnd - timing.connectStart || 0,
        // 白屏时间  
        wit: timing.responseStart - timing.navigationStart || 0,
        // dom渲染完成时间
        domt: timing.domContentLoadedEventEnd - timing.navigationStart || 0,
        // 页面onload时间
        lodt: timing.loadEventEnd - timing.navigationStart || 0,
        // 页面准备时间 
        radt: timing.fetchStart - timing.navigationStart || 0,
        // 页面重定向时间
        rdit: timing.redirectEnd - timing.redirectStart || 0,
        // unload时间
        uodt: timing.unloadEventEnd - timing.unloadEventStart || 0,
        //request请求耗时
        reqt: timing.responseEnd - timing.requestStart || 0,
        //页面解析dom耗时
        andt: timing.domComplete - timing.domInteractive || 0,
      }
    }

    /**
     * 统计页面资源性能
     */
    function perforResource() {
      if (!window.performance && !window.performance.getEntries) return false;
      let resource = performance.getEntriesByType('resource')

      let resourceList = [];
      if (!resource && !resource.length) return resourceList;

      resource.forEach((item) => {
        let json = {
          name: item.name,
          method: 'GET',
          type: item.initiatorType,
          duration: item.duration.toFixed(2) || 0,
          decodedBodySize: item.decodedBodySize || 0,
          nextHopProtocol: item.nextHopProtocol,
        }
        if (config.ajaxMsg && config.ajaxMsg.length) {
          for (let i = 0, len = config.ajaxMsg.length; i < len; i++) {
            if (config.ajaxMsg[i].url === item.name) {
              json.method = config.ajaxMsg[i].method || 'GET'
              json.type = config.ajaxMsg[i].type || json.type
            }
          }
        }
        resourceList.push(json)
      })
      config.resourceList = resourceList
    }

    /**
     * Ajax-hook
     */
    function _Ajax(funs) {
      //  保存真正的XMLHttpRequest对象
      window._ahrealxhr = window._ahrealxhr || XMLHttpRequest
      // 1.覆盖全局XMLHttpRequest，代理对象
      XMLHttpRequest = function () {
        // 创建真正的XMLHttpRequest实例
        this.xhr = new window._ahrealxhr;
        for (let attr in this.xhr) {
          let type = "";
          try {
            type = typeof this.xhr[attr]
          } catch (e) {}
          if (type === "function") {
            // 2.代理方法
            this[attr] = hookfun(attr);
          } else {
            // 3.代理属性
            Object.defineProperty(this, attr, {
              get: getFactory(attr),
              set: setFactory(attr)
            })
          }
        }
      }

      function getFactory(attr) {
        return function () {
          return this.hasOwnProperty(attr + "_") ? this[attr + "_"] : this.xhr[attr]
        }
      }

      function setFactory(attr) {
        return function (f) {
          let xhr = this.xhr
          let that = this
          // 区分是否回调属性
          if (attr.indexOf("on") != 0) {
            this[attr + "_"] = f
            return
          }
          if (funs[attr]) {
            xhr[attr] = function () {
              funs[attr](that) || f.apply(xhr, arguments)
            }
          } else {
            xhr[attr] = f
          }
        }
      }

      function hookfun(fun) {
        return function () {
          let args = [].slice.call(arguments)
          // 1.如果fun拦截函数存在，则先调用拦截函数
          if (funs[fun] && funs[fun].call(this, args, this.xhr)) {
            return;
          }
          // 2.调用真正的xhr方法
          return this.xhr[fun].apply(this.xhr, args)
        }
      }
      return window._ahrealxhr;
    }

    /**
     * 拦截fetch请求
     */
    function _fetch() {
      if (!window.fetch) return;
      let _fetch = fetch
      window.fetch = function () {
        let _arg = arguments
        let result = fetchArg(_arg)
        if (result.type === 'report-action-data' || result.type === 'report-leave-data') {
          return _fetch.apply(this, arguments)
        }
        if (result.type !== 'report-data') {
          clearPerformance()
          config.ajaxMsg.push(result)
          config.fetLength = config.fetLength + 1
          config.haveFetch = true
        }
        return _fetch.apply(this, arguments).then((res) => {
            if (result.type === 'report-data') return
            getFetchTime('success')
            return res
          }).catch((err) => {
            if (result.type === 'report-data') return
            getFetchTime('error')

            let defaults = Object.assign({}, errorDefault)
            defaults.time = new Date().getTime()
            defaults.resource = 'fetch'
            defaults.msg = 'fetch request error'
            defaults.method = result.method
            defaults.data = {
              resourceUrl: result.url,
              text: err.stack || err,
              status: 0
            }
            config.errorList.push(defaults)
            return err
          })
      }
    }

    /**
     * fetch参数整理
     */
    function fetchArg(arg) {
      let result = {
        method: 'GET',
        type: 'fetchrequest'
      }
      let args = Array.prototype.slice.apply(arg)

      if (!args || !args.length) return result
      try {
        if (args.length === 1) {
          if (typeof (args[0]) === 'string') {
            result.url = args[0]
          } else if (typeof (args[0]) === 'object') {
            result.url = args[0].url
            result.method = args[0].method
          }
        } else {
          result.url = args[0]
          result.method = args[1].method
          result.type = args[1].type
        }
      } catch (err) {}
      return result
    }

    /**
     * 拦截js error信息
     */
    function _error() {
        // 捕捉img,script,css,jsonp
        window.addEventListener('error', function (e) {
          let defaults = Object.assign({}, errorDefault);
          defaults.time = new Date().getTime();
          defaults.resource = 'resource'
          defaults.msg = e.target.localName + ' is load error';
          defaults.method = 'GET'
          defaults.data = {
            target: e.target.localName,
            type: e.type,
            resourceUrl: e.target.currentSrc,
          };
          if (e.target != window) config.errorList.push(defaults)
        }, true)

      // 捕捉js
      window.onerror = function (msg, _url, line, col, error) {
        let defaults = Object.assign({}, errorDefault);
        setTimeout(function () {
          col = col || (window.event && window.event.errorCharacter) || 0;
          defaults.msg = error && error.stack ? error.stack.toString() : msg
          defaults.method = 'GET'
          defaults.data = {
            resourceUrl: _url,
            line: line,
            col: col
          };
          defaults.time = new Date().getTime();
          config.errorList.push(defaults)
          getLargeTime()
        }, 0)
      };
    }

    /**
     * Ajax响应汇报
     */
    function ajaxResponse(xhr, type) {
      let defaults = Object.assign({}, errorDefault)
      defaults.time = new Date().getTime()
      defaults.resource = 'ajax'
      defaults.msg = xhr.statusText || 'ajax request error'
      defaults.method = xhr.method
      defaults.data = {
        resourceUrl: xhr.responseURL,
        text: xhr.statusText,
        status: xhr.status
      }
      config.errorList.push(defaults)
    }

    /**
     * 获取fetch的时间
     */
    function getFetchTime(type) {
      config.fetchNum += 1
      if (config.fetLength === config.fetchNum) {
        if (type == 'success') {
          console.log('走了 fetch success 方法')
        } else {
          console.log('走了 fetch error 方法')
        }
        config.fetchNum = config.fetLength = 0
        fetchTime = new Date().getTime() - beginTime
        getLargeTime();
      }
    }

    /**
     * 获取ajax的时间
     */
    function getAjaxTime(type) {
      config.loadNum += 1
      if (config.loadNum === config.ajaxLength) {
        if (type == 'load') {
          console.log('AJAX onload 方法')
        } else if (type == 'readychange') {
          console.log('AJAX onreadystatechange 方法')
        } else {
          console.log('error 方法')
        }
        config.ajaxLength = config.loadNum = 0
        ajaxTime = new Date().getTime() - beginTime
        getLargeTime();
      }
    }

    /**
     * 清理Performance
     */
    function clearPerformance(type) {
      if (!window.performance && !window.performance.clearResourceTimings) return;
      if (config.haveAjax && config.haveFetch && config.ajaxLength == 0 && config.fetLength == 0) {
        clear()
      } else if (!config.haveAjax && config.haveFetch && config.fetLength == 0) {
        clear()
      } else if (config.haveAjax && !config.haveFetch && config.ajaxLength == 0) {
        clear()
      }
    }

    /**
     * 清除参数
     */
    function clear() {
      performance.clearResourceTimings();
      config.performance = {}
      config.errorList = []
      config.preUrl = ''
      config.resourceList = ''
      config.page = location.href
      config.actionList = []
      ERRORLIST = []
    }

    /**
     * 获取XPath
     */
    function getXPath(elm) {
        let allNodes = document.getElementsByTagName('*')
        for (var segs = []; elm && elm.nodeType == 1; elm = elm.parentNode) {
          if (elm.hasAttribute('id')) {
            let uniqueIdCount = 0
            for (var n = 0; n < allNodes.length; n++) {
              if (allNodes[n].hasAttribute('id') && allNodes[n].id == elm.id) uniqueIdCount++;
              if (uniqueIdCount > 1) break;
            }
            if (uniqueIdCount == 1) {
              segs.unshift('//*[@id="' + elm.getAttribute('id') + '"]');
              return segs.join('/');
            } else {
              return false
            }
          } else {
            for (var i = 1, sib = elm.previousSibling; sib; sib = sib.previousSibling) {
              if (sib.localName == elm.localName) i++;
            }
            if (i == 1) {
              if (elm.nextElementSibling) {
                if (elm.nextElementSibling.localName != elm.localName) {
                  segs.unshift(elm.localName.toLowerCase())
                } else {
                  segs.unshift(elm.localName.toLowerCase() + '[' + i + ']');
                }
              } else {
                segs.unshift(elm.localName.toLowerCase())
              }
            } else {
              segs.unshift(elm.localName.toLowerCase() + '[' + i + ']');
            }
          }
        }
        return segs.length ? '/' + segs.join('/') : null
      }

      /**
       * 获取Xpath转dom元素
       */
      function getXpathToElem(path) {
        try {
          var evaluator = new XPathEvaluator();
          var result = evaluator.evaluate(path, document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return result.singleNodeValue || '';
        } catch (e) {
          return ''
        }
      }
      
      // 返回一些工具方法
      return {
        getXpathToElem,
        getXPath,
      }
  } catch (err) {
    console.log(err)
  }
}

// 兼容处理
if (typeof require === 'function' && typeof exports === "object" && typeof module === "object") {
  module.exports = HappyPerformance
} else {
  window.HappyPerformance = HappyPerformance
}

// 增加兼容Vue和React的配置
window.ERRORLIST = []
window.OTHERDATA = {}
HappyPerformance.addError = (err = {}) => {
  err = {
    method: 'GET',
    msg: err.msg,
    n: 'js',
    data: {
      col: err.col,
      line: err.line,
      resourceUrl: err.resourceUrl
    }
  }
  ERRORLIST.push(err)
}

HappyPerformance.otherData = fn => {
  fn && fn(OTHERDATA)
}