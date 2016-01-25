var _ = require('underscore');

module.exports = function(grunt) {

  var packageJSON = grunt.file.readJSON('package.json');
  var projectJSON = grunt.file.readJSON('project.json');

  var config = {
    pkg: packageJSON,
    cachebuster: {
      custom_json: {
        options: {
          basedir: '<%= pkg.root %>/dist/',
          format: 'json',
          length: 8
        },
        src: ['<%= pkg.root %>/dist/**/*'],
        dest: '<%= pkg.root %>/config.json'
      }
    }
  };
  
  _.extend(config, projectJSON);

  grunt.initConfig(config);

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-cachebuster');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-concat');

  var tasks = [
    'concat',
    'uglify', 
    'less', 
    'copy',
    'cachebuster'
  ];

  for (var i = 0; i < tasks.length; i++) {
    if(!config.hasOwnProperty(tasks[i])){
      tasks.splice(i, 1);
      i--;
    }
  };
   
  
  
  grunt.registerTask('default', tasks);

};