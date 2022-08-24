const fsExt = require('fs-extra')
module.exports = function createJsonFile(path, content) {
  fsExt.writeFileSync(path, JSON.stringify(content))
  console.log(`      ${path}`) 
}