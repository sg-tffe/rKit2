const fs = require('fs-extra')
const path = require('path')
module.exports = function deleteDirectory(dir) {
  if (fs.existsSync(dir) == true) {
      const files = fs.readdirSync(dir);
      files.forEach(item => {
          const item_path = path.join(dir, item);
          if (fs.statSync(item_path).isDirectory()) {
              deleteDirectory(item_path);
          }
          else {
              fs.unlinkSync(item_path);
          }
      });
      fs.rmdirSync(dir);
  }
}