var fs = require("fs");  
var P = require("pjs").P;  
var cfg = require('./config');
var $ = require('jquery');
var exec = require('child_process').exec;

var Grunt = P(function(s){
    s.init = function(){
        this.taskCfg = {}; //任务列表
        this.workLength = null; //遍历长度
    };

    /**
     * [生成项目配置文件]
     */
    s.generateProjects = function(cb){
        var me = this;
        var list = cfg.checkedList;
        me.workLength = list.length;
        list.forEach(function(o, i){
            var json;
            fs.readFile(cfg.grunt+'/project/'+o+'.json', 'utf8', function(err, data){
                var result = {};
                json = JSON.parse(data);
                for (var i in json) {
                    result[i] = {};
                    for(var j in json[i]){
                        result[i][o+j.replace(/(\w)/,function(v){return v.toUpperCase()})] = json[i][j];
                    }
                };
                $.extend(true, me.taskCfg, result);
                me.checkLength();
            });
        });
    };

    s.checkLength = function(){
        var me = this;
        var list = cfg.checkedList;
        var json;

        me.workLength--;
        if(me.workLength === 0){
            try{
                fs.writeFile(cfg.grunt+'/project.json', JSON.stringify(me.taskCfg, null, 4), function (err) {
                  if (err) throw err;
                  cfg.canBuild = true;
                });
            }catch(e){}
        }
    }

    /**
     * [构建]
     */
    s.build = function(){
        if(cfg.checkedList.length && cfg.canBuild){
            cfg.log('正在构建文件...');
            exec('grunt', {cwd: cfg.grunt}, function(err, msg){
                if(!err){
                    msg = msg.replace(/\[\w+m/g, '');
                    msg = msg.split('\n');
                    try{
                        msg.forEach(function(o, i){
                            cfg.log(o, {isList: true});
                        });
                    }catch(e){

                    }
                    cfg.log('构建完成');
                    cfg.log('======================================='); 
                }
                
            });
        }else{
            cfg.log('未选择项目或grunt下的项目配置文件未生成', {isError: true});
            cfg.log('=======================================');
        }
    }

});

module.exports = Grunt;
