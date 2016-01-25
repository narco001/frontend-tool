var fs = require("fs");  
var P = require("pjs").P;  
var cfg = require('./config');
var $ = require('jquery');
var exec = require('child_process').exec;

var Grunt = require('./grunt');
var pack = require('./package');

var Views = P(function(s){
    s.init = function(){
    	this.bindEvents();
    };

    /**
     * [绑定DOM事件]
     */
    s.bindEvents = function(cb){
		$('body').on('click', '.ui-project li', this.selectProject.bind(s));
        $('body').on('click', '.btn-grunt', this.build.bind(s));
        $('body').on('click', '.btn-pack', this.pack.bind(s));
        $('body').on('click', '.btn-pack-html', this.pack.bind(s));
        $('body').on('click', '.ui-env li', this.setEnv.bind(s));
        $('body').on('click', '.btn-compare', this.compare.bind(s));
    };

    /**
     * [选择项目]
     */
    s.selectProject = function(e){
    	e.preventDefault();
        var $target = $(e.currentTarget).toggleClass('active');
		var grunt = Grunt();
		var name = $target.data('name');
		var l = cfg.checkedList;
		var index = l.indexOf(name);
		if(index !== -1){
			l.splice(index, 1);
		}else{
			l.push(name);
		}
		cfg.canBuild = false;
		grunt.generateProjects();
    };

    /**
     * [构建]
     */
    s.build = function(e){
        e.preventDefault();
        var grunt = Grunt();
        grunt.build();
    };

    /**
     * [打包]
     */
    s.pack = function(e){
        e.preventDefault();
        var type = $(e.currentTarget).hasClass('btn-pack-html') ? 'html' : 'statics';
        var p = pack(type);
        p.start();
    };

    /**
     * [打包]
     */
    s.setEnv = function(e){
        e.preventDefault();
        $('.ui-env .active').removeClass('active');
        var env = $(e.currentTarget).toggleClass('active').data('env');
        cfg.setEnv(env);
    };

    /**
     * [版本比较]
     */
    s.compare = function(e){
        e.preventDefault();
        var $target = $(e.currentTarget);
        var versions = $target.data('version');
        var file =  $target.data('file');
        var command = 'git difftool ' + versions + ' ' + file;
        var root = $target.data('build') ? cfg.localRepo + '/build' : cfg.localRepo;
        exec(command, {cwd: root});
    };

});

module.exports = Views;
