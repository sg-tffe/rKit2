# rui-rkit2

rui-rkit2 是一个基于 Webpack 的打包工具，它利用插件机制封装了各种 JavaScript 应用的配置，选择和安装合适的插件即可开始构建你的应用。


## 安装

- latest 稳定版: `[sudo] npm install rui-rkit2 -g`

## node.js 版本
- node >=8

## 快速开始

1. 创建目录 `mkdir rkit-app && cd rkit-app`
2. 初始化工程 `rui-rkit2 init` 选择模版
3. 安装依赖 `npm install`
4. 启动服务 `npm run dev`
初始化结束后，项目中会生成一个名为 `rkit.config.js` 的配置文件：
## hooks
新增hooks配置  
```
hooks:{
  brefore: (config) => {},  //编译前钩子
  after: (config) => {} //编译后钩子
}
```
## 支持国际化打包
```
domainList: [{
  domain: `/[/test.xxx.comn`, //域名
  path: 'en', //目录
  isBuild: true // 是否编译
}]
// 生成目录为dist/en/xxxx(版本号)
// 注意：如何domainList存在isBuild为true的选项时会覆盖publicPath打包结果
```

## 支持强制DIFF流程
- 请在rkit.config.js中配置，例如： `projectName: 'easyLoan'`
- 分支生成的DIFF,必须在codereview平台被他人通过才能进行npm run build
- npm run build 
   - 选择分支可以指定分支md5 作为版本号
   - 选择部署环境，bate 为线下环境，production为线上环境

注：老版本中，原有的*build/prod.env.js*已经废弃，更新 1.2.7 后即可删除

## 支持同步静态文件
- 请在rkit.config.js中配置，例如： `syncHost: '10.1.1.1'`
- 运行`rui-rkit2 sync`,将会上传到配置的*syncHost*该主机内，并在控制台返回存储路径

## 支持同步SourceMap到Sentry

运行 `rui-rkit2 sync --sentry`将上传并发布sentry版本，发布版本为最近一次npm run build的版本和环境变量，写入在.sentryVariable中

在项目中引入Sentry SDK 可以使用以下环境变量作为标识：

- process.env.VUE_APP_DEPLOY_ENV ：部署环境
- process.env.VUE_APP_DEPLOY_VESION ：当前项目版本号


注：npm run build 将会自动生成`.sentryVariable`用于存储版本信息，请加入到*.gitignore*中避免上传到git仓库

```.gitignore
.sentryVariable
```
## rui-rkit2 build 支持手动传入branch、envs字段
- 运行rui-rkit2 build --branch [分支名] --envs [beta/online]


## 配置文件选项 参考
https://cli.vuejs.org/zh/config/#%E5%85%A8%E5%B1%80-cli-%E9%85%8D%E7%BD%AE

## 命令 rui-rkit2 help

- init - 初始化项目
- serve - 启动服务
- build - 生产环节编译
- inspect - 生存webpack 配置
- lint - 检测代码
- sync - 上传静态文件和sourcemap


## change log  
1.修复staticPath文件缺少冒号问题    
2.新增hooks配置
3.config文件生成样式文件顺序错乱的问题，新增pc模版
4.新增强制codereview流程
5.新增上传静态文件到远程主机
6.删除上传soucemap到sentry服务
7.rui-rkit2 build流程新增非必传字段[--branch] 、[--envs]
8.rui-rkit2 build 命令的传参[--mode]，新增mode类型为[test], 用于线下联调、提测环境打包，区分线上, 上线时打包可以不传或者传[production]
```
线下联调、提测使用：
    rui-rkit2 build --mode test

上线使用：
    rui-rkit2 build 
    rui-rkit2 build --mode production
```