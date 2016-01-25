# 一个方便增量打包的前端工具

### 特性

1. 可选择项目进行构建，build目录：未压缩的合并文件，方便调试和比对文件；dist目录：待打包的压缩文件
2. 可选择项目进行打包，包中的css、js、img均为增量文件，css、js头部带git版本号和最新修改的作者
3. 打包完成的css、js可通过build目录下对应的文件与线上文件进行比对
4. css中的静态文件均带有版本号

### 使用步骤

- git、node、grunt环境
- 安装node webkit，http://nwjs.io/
- 配置全局变量，添加git、beyondcompare到path
- git配置，本工具使用git https(ssh您可以自行尝试)的方式
	- git config --global diff.tool bc3
	- git config --global difftool.bc3.cmd 'BCompare "$LOCAL" "$REMOTE"'
	- git config --global difftool.prompt false
	- git config --global credential.helper store
	- git config user.name yourname
	- git config user.email yourname@test.com
- 目录结构：node-webkit下的文件直接复制到安装完的nodewebkit目录下；grunt目录为测试grunt配置；example为测试项目
- 配置文件：
	- node-webkit下的config.json
		- git 远程git地址(https)
		- grunt 本地grunt目录
		- hasHtml 是否需要自动编译和打包html文件
		- environment 可添加测试环境、生产环境等,url-该环境下静态文件的根目录,name-环境名称
	- grunt目录下的package.json
		- root 您的本地项目路径
	- grunt目录下的project目录
		- project-list.json 增加删除项目
		- 其余文件：project-list.json中项目对应的grunt配置文件

###注意事项
	- 使用jwt等纯web service方式加载数据的项目建议使用example/html下的例子，页面使用.html文件，配置hasHtml为true即可以使用html的自动编译和打包功能
	- 使用.jsp,.php等服务端语言的页面，您需要在gruntfile中自行生成带版本号的文件(需要和构建生成的config.json中的文件的md5值保持一致)。页面中需要加上诸如$getVersion('projecta/css/main.css')这样的方法生成文件的版本号