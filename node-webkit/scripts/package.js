var fs = require("fs");  
var P = require("pjs").P;  
var cfg = require('./config');
var Jszip = require("jszip");  
var exec = require('child_process').exec;
var async = require("async");  
var request = require('request');
var $ = require('jquery');

var Package = P(function(s){
    s.init = function(){
       this.git = null;
       this.zip = null;
       this.fileMap = {}; //config.json文件列表
       this.selectedFileMap = {}; //选中项目下的文件
       this.scanLength = 0; //扫描文件数
       this.fileLength = 0; //需打包的文件数
    };

    /**
     * [打包]
     */
    s.start = function(){
        var me = this;
        $('#fileDialog').remove();
        if(cfg.checkedList.length){
            this.git = require('simple-git')('./');
            this.zip = new Jszip;
            
            var isExist = fs.existsSync(cfg.localRepo);

            if(isExist){
                this.gitPull();
            }else{
                cfg.log('正在clone ' + cfg.git);
                this.git.clone(cfg.git, cfg.localRepo, function(){
                    cfg.log('完成clone ' + cfg.git);
                    me.gitPull();
                });
            }
        }else{
            cfg.log('请选择项目', {isError: true});
            cfg.log('=======================================');
        }
        
    }

    /**
     * [远程获取git数据]
     */
    s.gitPull = function(isHtml){
        var me = this;
        this.git = require('simple-git')(cfg.localRepo);
        this.git.pull(cfg.git, 'master', function(err, update) {

            if(update) {
                fs.readFile(cfg.localRepo+'/config.json', 'utf8', function(err, data){
                    console.log(me.fileMap)
                    me.fileMap = JSON.parse(data);
                    
                    me.extract();
                    
                });
                
            }
            if(err){
                cfg.log(err, {isError: true});
            }
        });
    }

    s.checkLength = function(){
        this.scanLength--;
        
        if(this.scanLength === 0){
            this.generateZip();
        }
    }

    s.generateZip = function(){
        var me = this;
        var type = me.type;
        var list = cfg.checkedList;
        var length = list.length;
        var fileLength = this.fileLength;
        var baseRoot = type == 'html' ? 'html' : 'statics/'+cfg.baseRoot;
        
        if(fileLength > 0){
            cfg.log('正在打包');
            list.forEach(function(o, i){
                var folder = baseRoot+'/'+o;
                fs.exists(folder, function(exists){
                    if(exists){
                        cfg.scanFolder(folder, me.zip);
                    }
                    length--;
                    if(length == 0){
                        me.getZip();
                    }
                });     
            });
            
        }else{
            exec('rm -rf statics',function(err,out) { 
                cfg.log('没有需要打包的文件');
                cfg.log('=======================================');
            });
            
        }
        
    }

    s.getZip = function(){
        var type = this.type;
        var data = this.zip.generate({base64:false,compression:'DEFLATE'});
        var chooser = $('<input id="fileDialog" type="file" style="display:none;" />').appendTo('body');
        var time = +new Date;
        chooser.attr('nwsaveas', type+'-'+time+'.zip');
        exec('rm -rf '+type,function(err,out) {
            cfg.log('打包完成');
            cfg.log('=======================================');
        });
        chooser.click();
        chooser.change(function (e) {
            var path = e.target.files[0].path;
            fs.writeFile(path, data, 'binary', function(){});
        });
    }

    /**
     * [提取文件]
     */
    s.extract = function(){
        var me = this;
        me.scanLength = 0;
        me.fileLength = 0;
        me.selectedFileMap = cfg.getFileMap(me.fileMap);
    }

});

var Statics = P(Package, function(s, parent){
    s.init = function(){
        parent.init.apply(this, arguments);
        this.type = 'statics';
    };

    s.extract = function(){
        var me = this;
        parent.extract.apply(this, arguments);
        cfg.log('需要打包的静态文件：');
        for (var i in me.selectedFileMap) {
            me.scanFiles(i);
        };
    }

    /**
     * [扫描文件]
     * @param {[String]} [i] [config.json中的文件名]
     */
    s.scanFiles = function(i){
        var me = this;
        var fileMap = me.selectedFileMap;
        var index = i.lastIndexOf('.');
        var name = i.substr(0, index);
        var fileType = i.substr(index+1);

        var result = name + '_' + fileMap[i] + '.' + fileType;
        var noversionResult = name + '.' + fileType;
        var remoteFile = cfg.curEnv.url + '/' + result;
        var remoteNoversionFile = cfg.curEnv.url + '/' + noversionResult;

        var fileInfo = {
            result: result,
            noversionResult: noversionResult,
            remoteFile: remoteFile,
            remoteNoversionFile: remoteNoversionFile
        }
         
        me.scanLength++;

        async.waterfall([
            function(callback){
                me.getRemoteFile(fileInfo, callback);
            }, 
            function (versionFile, from, fileInfo, callback) {
                me.git.log({
                    file: from.replace(/^data\/(.*)$/, '$1')
                }, function(err, data){
                    callback(null, versionFile, data, fileInfo);
                });
            }, 
            me.writeFile.bind(me), 
            me.addVersion.bind(me)
        ], function(versionFile, version, remoteVersion){
            cfg.log(noversionResult, {isList: true});
            if(version){
                if(remoteVersion){
                    cfg.log(result + '<span class="file-info"><button type="button" class="btn btn-lg btn-primary btn-compare" data-version="'+version+' '+remoteVersion+'" data-file="'+noversionResult+'" data-build="1">改动比较</button></span>', {isList: true});
                }else{
                    cfg.log(result + '<span class="file-info">这是一个新文件</span>', {isList: true});     
                }
            }else{
                cfg.log(result, {isList: true});    
            }
            
            me.fileLength++;

            me.checkLength();
        });
    }

    /**
     * [比对远程文件]
     * @param {[fileInfo]} [fileInfo] [文件信息]
     * @param {[Function]} [callback] [回调函数]
     */
    s.getRemoteFile = function(fileInfo, callback){
        var me = this;
        var noversionResult = fileInfo.noversionResult;

        request(fileInfo.remoteFile, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                me.checkLength();
            }
            if(!error&& response.statusCode == 404){

                var from = cfg.distRoot + '/' + noversionResult;
                var to = cfg.baseRoot + '/' + noversionResult;
                var versionFile = 'statics/' + cfg.baseRoot + '/' + fileInfo.result;

                cfg.copyFile(from, 'statics/' + to, function(){
                    exec('cp '+from+' '+versionFile, function(){

                        callback(null, versionFile, from, fileInfo);
                    })
                });
            }
        }); 
    }

    /**
     * [css文件内的静态资源添加版本号]
     * @param {[String]} [versionFile] [带版本的文件]
     * @param {[Object]} [gitLog] [git信息]
     * @param {[fileInfo]} [fileInfo] [文件信息]
     * @param {[Function]} [callback] [回调函数]
     */
    s.writeFile = function(versionFile, gitLog, fileInfo, callback){
        var me = this;
        var gitInfo = gitLog && gitLog.all && gitLog.all[0];
        var fileMap = me.selectedFileMap;
        var project = fileInfo.result.replace(/([^\/]*)\/.*/, '$1');
        // console.log(me.selectedFileMap)
        if(versionFile.indexOf('.css') !== -1){
            fs.readFile(versionFile, 'utf8', function(err, data){
                var name = data.match(/[^\/]+\.(jpg|gif|png|eot|ttf|woff|svg)/g);
                var bgNameList = data.match(/url\(["']*(.*?)["']*\)/g);
                
                for(var j in fileMap){
                    var fullFileName = j;
                    var staticsPath = fullFileName.replace(/^[^\/]*\/([^\/]*)\/.*$/, '$1');
                    var fileName = j.substr(j.lastIndexOf('/')+1);
                    var basePath = project + '/' + staticsPath;
                    //当前项目下的文件和非当前项目下的文件均需添加版本号
                    if((name.indexOf(fileName) !== -1 && fullFileName.indexOf(basePath) !== -1) || isIn(fullFileName, bgNameList)){
                      var fileArr = fileName.split('.');
                      fileArr[0] += '_'+fileMap[j];
                      var curFileName = fileArr.join('.');
                      data = data.replace(new RegExp('/'+fileName, 'g'), '/'+curFileName);
                      
                    }
                }

                fs.writeFile(versionFile, data, function (err) {
                  if (err) throw err;
                  callback(null, versionFile, gitInfo, fileInfo);
                });
            });

        }else{
            callback(null, versionFile, gitInfo, fileInfo);
        };

        function isIn(val, list){
            var result = false;
            list.forEach(function(o, i){
                if(o.indexOf(val) !== -1){
                    result = true;
                }
            });
            return result;
        }
    }

    /**
     * [css/js头部添加版本信息]
     * @param {[String]} [versionFile] [带版本的文件]
     * @param {[Object]} [gitLog] [git信息]
     * @param {[fileInfo]} [fileInfo] [文件信息]
     * @param {[Function]} [callback] [回调函数]
     */
    s.addVersion = function(versionFile, gitInfo, fileInfo, callback){
        var me = this;
        var remoteNoversionFile = fileInfo.remoteNoversionFile;
        var noversionResult = fileInfo.noversionResult;
       
        if(/\.(css|js)$/.test(versionFile)){
            var author = gitInfo.author_email;
            var version = gitInfo.hash;
            try{
                version = /\'*(.*)\s*/g.exec(version)[1];
                version = version.slice(0, 6);
            }catch(e){}
            var str = '/*\n *@author: ' + author + '\n *@version: ' + version + ' \n*/ \n\n';
            
            cfg.prependFile(versionFile, str, function(){
                var baseFile = 'statics/' + cfg.baseRoot + '/' + noversionResult;

                cfg.prependFile(baseFile, str, function(){
                    request(remoteNoversionFile, function (error, response, body) {
                        if (!error && response.statusCode == 200) {
                            var reg = /\*@version:\s+\'*(.*)\s+\*\//g.exec(body);

                            if(reg && reg[1]){
                                var remoteVersion = reg[1].slice(0, 6);
                                callback(versionFile, version, remoteVersion);
                            }else{
                                callback(versionFile, version, null);
                            }
                        }
                        if(!error&& response.statusCode == 404){

                            callback(versionFile, version, null);
                        }
                    }); 
                    
                });
            })
        }else{
            callback(versionFile);
        }
    }

});

var Html = P(Package, function(s, parent){
    s.init = function(){
        parent.init.apply(this, arguments);
        this.type = 'html';
        this.htmlList = []; //html列表
    };

    /**
     * [需打包的html列表]
     */
    s.setList = function(){
        var me = this;
        cfg.checkedList.forEach(function(o, i){
            var folder = cfg.localRepo+'/'+o;
            var result = cfg.scanFolder(folder);
            var files = result.files;
            files.forEach(function(file, j){
                if(file.indexOf('-source.html') !== -1){
                    me.htmlList.push(file);
                }
            });
            
        });
    }

    s.extract = function(){
        var me = this;
        parent.extract.apply(this, arguments);
        cfg.log('需要打包的html文件：');
        me.setList();
        
        me.htmlList.forEach(function(file, i){
            me.scanFiles(file, i);
        });
    }

    /**
     * [扫描文件]
     * @param {[String]} [i] [config.json中的文件名]
     */
    s.scanFiles = function(file, i){
        var me = this;
        var index = file.indexOf('-source.html');
        var fileName = file.slice(0, index);
        var result = fileName + '.html';
        result = result.replace(/^data\/(.*?)$/, '$1');
        var remoteFile = cfg.curEnv.url + '/' + result;
        var version;
        var remoteVersion;

        var fileInfo = {
            file: file,
            result: result,
            version: '',
            remoteVersion: '',
            remoteFile: remoteFile
        }

        me.scanLength++;

        async.waterfall([
            function(callback){
                me.getVersion(fileInfo, callback);
            },
            me.getRemoteFile.bind(me), 
            me.copyFile.bind(me), 
            me.replaceDebug.bind(me), 
            function(file, str, callback){
                cfg.prependFile(file, str, function(){
                    callback(null, file);
                });
            }, 
            me.replaceStatics.bind(me)
        ], function(){
            if(remoteVersion){
                cfg.log(result + '<span class="file-info"><button type="button" class="btn btn-lg btn-primary btn-compare" data-version="'+version+' '+remoteVersion+'" data-file="'+gitFile+'">改动比较</button></span>', {isList: true});
            }else{
                cfg.log(result, {isList: true});     
            }
            me.fileLength++;
            me.checkLength();
        });
    }

    /**
     * [比对远程文件]
     * @param {[Function]} [callback] [回调函数]
     * @param {[fileInfo]} [fileInfo] [文件信息]
     
     */
    s.getRemoteFile = function(fileInfo, callback){
        var me = this;
        var reg = /\<!--\s+version:(\w{6})\s+--\>/;
        request(fileInfo.remoteFile, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                if(!(body.indexOf('version:'+fileInfo.version) !== -1)){

                    var remoteVersion = reg.exec(body);
                    if(remoteVersion){
                        remoteVersion = remoteVersion[1];
                    }   
                    fileInfo.remoteVersion = remoteVersion;
                }
                callback(null, fileInfo); 
            }
            if(!error&& response.statusCode == 404){
                callback(null, fileInfo);
            }
        }); 
    }

    /**
     * [提取当前扫描html的版本号]
     * @param {[fileInfo]} [fileInfo] [文件信息]
     * @param {[Function]} [callback] [回调函数]
     
     */
    s.getVersion = function(fileInfo, callback){
        var me = this;
        var gitFile = fileInfo.file.replace(/^data\/(.*?)$/, '$1');
        me.git.log({
            file: gitFile
        }, function(err, gitLog){
            var gitInfo = gitLog && gitLog.all && gitLog.all[0];
            if(gitInfo){
                var version = gitInfo.hash;
                version = /\'*(.*)\s*/g.exec(version)[1];
                version = version.slice(0, 6);
                fileInfo.version = version;
                callback(null, fileInfo);
            }
        });
    }

    /**
     * [复制文件到临时目录]
     * @param {[fileInfo]} [fileInfo] [文件信息]
     * @param {[Function]} [callback] [回调函数]
     
     */
    s.copyFile = function(fileInfo, callback){
        var me = this;
        var file = fileInfo.file;
        var to = file.replace(/^data/g, 'html');
        cfg.copyFile(file, to, function(){
            callback(null, to, fileInfo);
        });
    }

    /**
     * [更新临时目录中的html文件,替换变量,删除source文件]
     * @param {[String]} [file] [临时目录中的html文件]
     * @param {[fileInfo]} [fileInfo] [文件信息]
     * @param {[Function]} [callback] [回调函数]
     */
    s.replaceDebug = function(file, fileInfo, callback){
        var me = this;
        var str = '<!-- version:'+ fileInfo.version +' -->\n\r';
        var to = 'html/' + fileInfo.result;
        cfg.generateFile(to, file, false, function(){
            exec('rm -rf '+file,function(err,out) { 
                callback(null, to, str);
            });
        });
    }

    /**
     * [更新临时目录中的html文件,为静态文件添加版本号]
     * @param {[String]} [file] [临时目录中的html文件]
     * @param {[Function]} [callback] [回调函数]
     */
    s.replaceStatics = function(file, callback){
        var me = this;
        var reg = /\$\{getVersion\(\'(.*?)\'\)\}/g;
        var result = [];
        fs.readFile(file, 'utf8', function(err, data){
            var fileName;
            while(fileName = reg.exec(data)){
                result.push(fileName[1]);

                var versionFile = cfg.getVersion(fileName[1], me.selectedFileMap);
                
                data = data.replace(fileName[0], versionFile);
                
            }
            
            fs.writeFile(file, data, function(){
                callback();
            });

        });
    }

});

function init(type){
    type = type || 'statics';
    switch(type){
        case 'statics':
            return Statics();
        case 'html':
            return Html();
    }
}

module.exports = init;
