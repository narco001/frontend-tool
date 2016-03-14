var fs = require("fs");  
var $ = require("jquery");  
var async = require("async");  
var path = require("path");  

var config = {
	git: '', //git地址
	grunt: '', //grunt目录
	environment: {}, //环境
	canBuild: false, //是否能构建
	checkedList: [], //项目选中列表
	localRepo: 'data', //本地git路径
	baseRoot: 'dist', //dist文件目录
	distRoot: '',  //本地压缩文件
	hasHtml: 0, //是否需要自动编译和打包html文件
	curEnv: {}, //当前环境
	branch: 'master',
	setEnv: function(env, branch){
		this.curEnv = this.environment[env];
		this.branch = branch;
	},
	/**
	 * [log 输出信息]
	 * @param  {[String]} log [信息]
	 */
	log: function(str, options){
		var $log = $('.ui-log');
		if(options && options.proxy){
			$log = $('.ui-log-proxy');
		}
		var $inner = $('.inner', $log);
		var $item = $('<div class="item-log">'+str+'</div>').appendTo($inner);
		var height = $inner.height();
		$log.scrollTop(height);
		if(options){
			if(options.isList){
				$item.addClass('item-log-list');
			}
			if(options.isError){
				$item.addClass('item-log-error');
			}
		}
	},
	getFileMap: function(fileMap){
		var result = {};
		
		this.checkedList.forEach(function(o, i){
			for(var j in fileMap){
				if(fileMap.hasOwnProperty(j) && j.indexOf(o) !== -1){
					var prop = j.replace(/\\/g, '/');
					result[prop] = fileMap[j];
				}
			}
		});

		return result;
		
	},
	/**
	 * [深层扫描文件]
	 * @param  {[String]} path [扫描的目录]
	 * @param  {[Object]} path [是否需要压缩成zip]
	 * @return {[Object]}      [文件、文件夹列表]
	 */
	scanFolder: function(path, zip ,ignoreList){
	    var fileList = [];
	    var folderList = [];
	    var result;
	    var walk = function(path, fileList, folderList){
	    	
			files = fs.readdirSync(path);
	        files.forEach(function(item) {  
	            var tmpPath = path + '/' + item;
	            var stats = fs.statSync(tmpPath);
	            var canAdd = true;
	            if(ignoreList){
	            	ignoreList.forEach(function(o, i){
	            		if(tmpPath.indexOf(o) !== -1){
	            			canAdd = false;
	            		}
	            	});
	            }
	            if(!canAdd){
	            	return;
	            }
	            if (stats.isDirectory()) {  
	                walk(tmpPath, fileList, folderList); 
	                folderList.push(tmpPath); 
					
	            } else {  
	        		fileList.push(tmpPath); 
	        		var fileName = tmpPath.replace(/.*\/(.*)$/g, '$1');
	        		if(zip){
	        			var folderPath = path;
	        			if(folderPath.indexOf('statics/') !== -1){
	        				folderPath = folderPath.replace(/^statics\//g, '');	
	        			}
	        			
	        			zip.folder(folderPath).file(fileName, fs.readFileSync(tmpPath));	
	        		}
	            }  
	        });  
	    	  
	        
	    };  

	    walk(path, fileList, folderList);

	    result = {
	        'files': fileList,
	        'folders': folderList
	    };

	    return result;
	},
	/**
	 * [single file copy]
	 * @param  {[String]}   file  [文件名]
	 * @param  {[String]}   toDir [目标目录]
	 * @param  {Function} cb    [回调]
	 */
	copyFile: function(file, toDir, cb) {
		var me = this;
		async.waterfall([
			function (callback) {
				fs.exists(toDir, function (exists) {
					if (exists) {
						callback(null, false);
					} else {
						callback(null, true);
					}
				});
			}, function (need, callback) {
				if (need) {
					me.mkdirs(path.dirname(toDir), callback);
				} else {
					callback(null, true);
				}
			}, function (p, callback) {
				var reads = fs.createReadStream(file);
				var writes = fs.createWriteStream(path.join(path.dirname(toDir), path.basename(file)));
				reads.pipe(writes);
				//don't forget close the  when  all the data are read
				reads.on("end", function () {
					writes.end();
					callback(toDir);
				});
				reads.on("error", function (err) {
					console.log("error occur in reads", err);
					callback(true, err);
				});

			}
		], cb);

	},
	/**
	 * [cursively make dir]
	 */
	mkdirs: function(p, mode, f, made) {
		var me = this;
		if (typeof mode === 'function' || mode === undefined) {
			f = mode;
			mode = 0777 & (~process.umask());
		}
		if (!made)
			made = null;

		var cb = f || function () {};
		if (typeof mode === 'string')
			mode = parseInt(mode, 8);
		p = path.resolve(p);

		fs.mkdir(p, mode, function (er) {
			if (!er) {
				made = made || p;
				return cb(null, made);
			}
			switch (er.code) {
			case 'ENOENT':
				me.mkdirs(path.dirname(p), mode, function (er, made) {
					if (er) {
						cb(er, made);
					} else {
						me.mkdirs(p, mode, cb, made);
					}
				});
				break;

				// In the case of any other error, just see if there's a dir
				// there already.  If so, then hooray!  If not, then something
				// is borked.
			default:
				fs.stat(p, function (er2, stat) {
					// if the stat fails, then that's super weird.
					// let the original error be the failure reason.
					if (er2 || !stat.isDirectory()) {
						cb(er, made);
					} else {
						cb(null, made)
					};
				});
				break;
			}
		});
	},
	prependFile: function(file, str, cb){
		fs.readFile(file, 'utf8', function(err, data){
			var txt = str + data;

			fs.writeFile(file, txt, function (err) {
			  if (err) throw err;
			  cb();
			});
		});
	},
	/**
	 * [根据现有文件生成文件]
	 * @param  {[String]} log [生成的文件路径]
	 * @param  {[String]} log [源文件]
	 * @param  {[Boolean]} log [是否为开发环境的文件]
	 */
	generateFile: function(fileName, from, isDebugFile, cb){
		var debugReg = /\#if\(\s*debug\s*\)([\s\S]*?)\#else([\s\S]*?)\#end/g;
		fs.readFile(from, 'utf8', function(err, data){
			if(isDebugFile){
				data = data.replace(debugReg, '$1');
			}else{
				data = data.replace(debugReg, '$2');
			}
			fs.writeFile(fileName, data, function (err) {
			  if (err) throw err;
			  cb();
			});
		});
	},
	/**
	 * [获取文件版本号]
	 * @param  {[type]} fileName [文件名]
	 * @param  {[type]} fileMap  [文件列表]
	 */
	getVersion: function(fileName, fileMap){
	    var result = '';
	    var json = fileMap;
	    for(var i in json){
	      var val = json[i];
	      
	      if(fileName.indexOf(i) !== -1){
	      	
	        var index = i.lastIndexOf('.');
	        var name = i.substr(0, index);
	        var type = i.substr(index);
	        var result = name + '_' + val + type; 
	      }
	      
	    }
	    return this.curEnv.url + '/' + result;
	    
	}
};

module.exports = config;
