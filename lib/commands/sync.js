const fs = require('fs')
const path = require('path')
const http = require("http")
const util = require('util')
const fse = require('fs-extra')

const { 
  error,
  info,
  stopSpinner,
  logWithSpinner
} = require('@vue/cli-shared-utils')
const exec = util.promisify(require('child_process').exec)

module.exports = (api, options) => {
  api.registerCommand('sync', {
    description: 'sync static files to remote host',
    usage: 'rkit sync [options]',
    options: {
    }
  }, async (args) => {
    const distDir = api.resolve(options.outputDir)

    const existsDist = await fse.pathExists(distDir)
    if(!existsDist) {
      error(`构建文件不存在，请先执行 npm run build`)
      return false
    }
    const { assetsDir: version } = options
    if (!options.syncHost) {
      error(`rkit.config.js未配置syncHost\n`)
      info('请尝试以下操作解决：\n')
      console.log('    * 在rkit.config.js内配置: syncHost: 10.0.0.1\n')
      return false
    }
    if (!Array.isArray(options.syncHost) || !options.syncHost.length) {
      error(`rkit.config.js配置的syncHost应该是数组类型,不能为空\n`)
      info('请尝试以下操作解决：\n')
      console.log('    * 在rkit.config.js内配置: syncHost: [10.0.0.1, 10.12.17.48]\n')
      return false
    }
    if (!options.projectName) {
      error(`rkit.config.js未配置项目名\n`)
      info('请尝试以下操作解决：\n')
      console.log('    * 在rkit.config.js内配置: projectName: name\n')
      return false
    }
    const syncApiOptions = []
    syncApiOptions.push({
      port: 3000,
      path: '/file_upload',
      host: options.syncHost,
      businessType: options.businessType || '',
      projectName: options.projectName,
      filePath: `${distDir}/${version}.zip`,
      version: version
    })
    try {
      if (options.domainList && Array.isArray(options.domainList)) {
        await Promise.all(
          options.domainList
            .map(({ path: dir, isBuild }) => {
              if (!isBuild) return null
              syncApiOptions.push({
                port: 3000,
                path: '/file_upload',
                host: options.syncHost,
                businessType: options.businessType || '',
                projectName: `${options.projectName}/${dir}`,
                filePath: `${path.join(distDir, dir)}/${version}.zip`,
                version: version
              })
              return exec(`zip ${version}.zip -x *.map -q -r */`, {
                cwd: path.join(distDir, dir),
              })
            })
            .filter(Boolean)
        )
      }
      await exec(`zip ${version}.zip -x *.map -q -r */`, { cwd: distDir })
      for(let i=0; i< syncApiOptions.length; i++) {
        await syncFile(syncApiOptions[i], syncApiOptions[i].projectName, version, syncApiOptions[i].businessType)
      }
    } catch (err) {
      error(`压缩静态文件出错！`, err)
      return false
    }
  })
}

function generateBoundary() {
  return `---------------------------${new Date().valueOf().toString(32)}`
}

async function syncRequest(options, filePath, businessType, projectName, version, boundary) {
  return new Promise((resolve, reject) => {
    logWithSpinner(`正在同步静态文件到：${options.host}`);
    const req = http.request(options, (res) => {
      res.on("data", (data) => {
        const res = JSON.parse(data.toString())
        if (+res.status === 0) {
          const data = res.data
          console.log("\r\n")
          resolve()
          info(`同步文件成功，存储目录为:${data.filePath}\r\n`)
        } else {
          reject()
          error("同步文件失败：", res.msg)
        }
        stopSpinner(false)
      })
    })
    req.on("error", (err) => {
      stopSpinner(false);
      error(`同步文件失败，请检查${options.host}服务是否正常`);
      reject()
    })

    req.write(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="businessType"\r\n\r\n${businessType}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="projectName"\r\n\r\n${projectName}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${version}.zip"\r\n` +
        `Content-Transfer-Encoding: binary \r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n`
    );

    const enddata = "\r\n--" + boundary + "--"
    const fileStream = fs.createReadStream(filePath, { bufferSize: 4 * 1024 })

    fileStream.pipe(req, { end: false });
    fileStream.on('error', (e) => {
      console.log('文件读取错误', e.message)
    })
    fileStream.on("end", () => {
      req.end(enddata)
    })
  })
}

async function syncFile(syncOption) {
  return new Promise(async (resolve, reject) => {
    const boundary = generateBoundary();
    const { host, port, path, projectName, filePath, version, businessType } = syncOption;
    
    for(let i=0; i< host.length; i++) {
      const options = {
        method: "POST",
        host: host[i],
        port: port,
        path: path,
        headers: {
          "Transfer-Encoding": "chunked",
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
      };
      await syncRequest(
        options,
        filePath,
        businessType,
        projectName,
        version,
        boundary
      )
      await sleep(1000)
    }
    fse.remove(filePath)
    resolve()
  })
}
function sleep(t) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, t)
  })
}
module.exports.defaultModes = {
  sync: 'production'
}