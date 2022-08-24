const fs = require('fs-extra')
const path = require('path')
const deleteDirectory = require('../../util/deleteDirectory')
let pageKeys = []
let publicPath = ''
module.exports = function internationBuild(outputDir, options, domainList) {
  pageKeys = Object.keys(options.pages)
  publicPath = options.publicPath
  console.log('files')
  domainList.map(item => {
    if(fs.existsSync(`${outputDir}/${item.path}`)) {
      deleteDirectory(`${outputDir}/${item.path}`);
    }
    fs.mkdirSync(`${outputDir}/${item.path}/`);
    console.log('\n')
    copyDirectory(`${outputDir}/${options.assetsDir}`, `${outputDir}/${item.path}/${options.assetsDir}`, item);
  })
}
function copyDirectory(from, to, domainInfo) {
  if (!fs.existsSync(from)) {
    return;
  }
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to)
  }
  // 拷贝新的内容进去
  const dirs = fs.readdirSync(from);
  dirs.forEach((item) => {
    const item_path = path.join(from, item);
    const temp = fs.statSync(item_path);
    if (temp.isFile()) { // 是文件
      detailFile(item_path, path.join(to, item), domainInfo);
    } else if (temp.isDirectory()){ // 是目录
      copyDirectory(item_path, path.join(to, item), domainInfo);
    }
  })
}
function detailFile(oldFile, newFile, domainInfo) {
  let needDealFile = /\.json$/.test(oldFile) || /\.js$/.test(oldFile);
  let isPage = true;
  if(/\.js$/.test(oldFile) && pageKeys.length) {
    // 此处不是很严谨 暂时这么做
    pageKeys.map((page) => {
      const reg = new RegExp(page, 'g')
      isPage = reg.test(oldFile) // 只需要针对pages的key对应的js文件做处理
    }) 
  }
  if(needDealFile && isPage) {
    fs.readFile(oldFile, (err, data) => {
      if(err) {
        console.log(err);
        return;
      }
      const content = data.toString().replace(new RegExp(publicPath, 'g'), `${domainInfo.domain}/${domainInfo.path}/`)
      if(/staticPath\.json$/.test(oldFile)){
        newFile = path.join(newFile, '../../staticPath.json')
      }
      fs.writeFile(newFile, content, err => {
        if(err) {
          console.log(err);
          return;
        } 
      })
    })
  } else {
    fs.copyFileSync(oldFile, newFile)
  }
  console.log(`     ${newFile}`)
}
