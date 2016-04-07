var fs = require("fs");  
var path = require("path");  
var P = require("pjs").P;  
var async = require("async");  
var exec = require('child_process').exec;
var $ = require('jquery');

var cfg = require('./scripts/config');
var Views = require('./scripts/views');

var Main = P(function(s){
    s.init = function(){
    	var me = this;
    	async.waterfall([
    		me.removeData.bind(me),
			me.getConfig.bind(me),
			me.initProjects.bind(me),
			me.initEnvironment.bind(me)
		], function(cb){
			
		});
    };

    /**
     * [刷新页面删除data目录]
     * @param {[Function]} [cb] [回调]
     */
    s.removeData = function(cb){
		exec('rm -rf data',function(err,out){
			cb(null);
		});
    };

    /**
     * [获取配置信息]
     * @param {[Function]} [cb] [回调]
     */
    s.getConfig = function(cb){
        var me = this;
    	fs.readFile('./config.json', 'utf8', function(err, data){
			try{
                $('.project-path').val(window.localStorage.getItem('project-path') || '');
				data = JSON.parse(data);
				cfg.git = data.git;
				cfg.grunt = data.grunt;
				cfg.environment = data.environment;
				cfg.baseRoot = data.distRoot || 'dist';
				cfg.distRoot = cfg.localRepo + '/' + cfg.baseRoot;
				cfg.hasHtml = data.hasHtml;
				if(cfg.hasHtml){
					$('.btn-pack-html').show();
                    me.autoBuild();
				}
				cb(null);
			}catch(e){
				console.error(e);
			}
		});
    };

    /**
     * [从grunt获取项目列表]
     * @param {[Function]} [cb] [回调]
     */
    s.initProjects = function(cb){
    	fs.readFile(cfg.grunt + '/project/project-list.json', 'utf8', function(err, data){
    		try{
				var list = JSON.parse(data);
				list.forEach(function(o, i){
					$('.ui-project').append('<li data-name="'+o[0]+'"><a href="###">'+o[0]+'('+o[1]+')</a></li>');
				});	
				
				cb(null);
			}catch(e){
				console.error(e);
			}
			

		});
    }

    /**
     * [环境]
     * @param {[Function]} [cb] [回调]
     */
    s.initEnvironment = function(cb){
    	var env = cfg.environment;
    	var hasSet = false;
    	for(var i in env){
    		var $item = $('<li data-env="'+i+'" data-branch="'+env[i]['branch']+'"><a href="###">'+env[i]['name']+'</a></li>').appendTo('.ui-env');
    		
    		if(!hasSet){
    			hasSet = true;
    			$item.addClass('active');
    			cfg.setEnv(i, env[i]['branch']);
    		}
    	}
		
		cb();
    }

    /**
     * [自动编译html]
     */
    s.autoBuild = function(){
        try{
            var projectPath = $('.project-path').val();
            var autoBuildFolders = cfg.scanFolder(projectPath, null, [
                'statics/.git', 
                'statics/build', 
                'statics/dist',
                '/css',
                '/images',
                '/scripts',
                '/fonts'
            ]);
            autoBuildFolders = autoBuildFolders ? autoBuildFolders.folders : null;
            
            if(autoBuildFolders){
                autoBuild(autoBuildFolders);
            }
        }catch(e){}
    }

    /**
     * [自动编译html]
     */
    function autoBuild(folders){
        var timer = null;
        folders.forEach(function(o, i){
            fs.watch(o, function(event, fileName){
                timer && clearTimeout(timer);
                timer = setTimeout(function(){
                    if(fileName){
                        var index = fileName.indexOf('-source.html');
                        if(index !== -1){
                            var name = fileName.slice(0, index);
                            var srcFile = o + '/' + name + '.html';
                            var from = o + '/' + fileName;
                            cfg.generateFile(srcFile, from, true, function(){

                            });
                        }
                    }
                }, 300);
                
            });
        });
    }

});

var views = Views();

var main = Main();
