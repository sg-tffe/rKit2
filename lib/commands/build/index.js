const md5 = require('md5');
const inquirer = require('inquirer')
console.log
const defaults = {
  clean: true,
  target: 'app',
  module: true,
  formats: 'commonjs,umd,umd-min'
}

const buildModes = {
  lib: 'library',
  wc: 'web component',
  'wc-async': 'web component (async)'
}

const modifyConfig = (config, fn) => {
  if (Array.isArray(config)) {
    config.forEach(c => fn(c))
  } else {
    fn(config)
  }
}

module.exports = (api, options) => {
  api.registerCommand('build', {
    description: 'build for production',
    usage: 'vue-cli-service build [options] [entry|pattern]',
    options: {
      '--mode': `specify env mode (default: production)`,
      '--dest': `specify output directory (default: ${options.outputDir})`,
      '--no-module': `build app without generating <script type="module"> chunks for modern browsers`,
      '--target': `app | lib | wc | wc-async (default: ${defaults.target})`,
      '--inline-vue': 'include the Vue module in the final bundle of library or web component target',
      '--formats': `list of output formats for library builds (default: ${defaults.formats})`,
      '--name': `name for lib or web-component mode (default: "name" in package.json or entry filename)`,
      '--filename': `file name for output, only usable for 'lib' target (default: value of --name)`,
      '--no-clean': `do not remove the dist directory contents before building the project`,
      '--report': `generate report.html to help analyze bundle content`,
      '--report-json': 'generate report.json to help analyze bundle content',
      '--skip-plugins': `comma-separated list of plugin names to skip for this run`,
      '--watch': `watch for changes`,
      '--stdin': `close when stdin ends`,
      '--branch': 'get current branch name',
      '--envs': 'get deploy environment'
    }
  }, async (args, rawArgs) => {
    const prompt = inquirer.createPromptModule();
    const {
      getCurBranch,
      getBuildBranch,
    } = require('../../util/getBuildBranch')

    let envs = [
      'beta',
      'online'                
    ],
      curBranch = ''

    if (!options.projectName) {
      error(`请先在rkit.config.js内配置：projectName字段，即项目名。`)
      return false
    }

    if (!args.branch) {

      curBranch = await getCurBranch()

      let branchs = await getBuildBranch(),
          branchIdx = branchs.indexOf(curBranch)
      
      if (branchIdx !== -1) {
          branchs.splice(branchIdx, 1)
          branchs.unshift(curBranch)
      }

      await prompt([{
          type: 'list',
          message: 'Please select a branch as the version number',
          name: 'line',
          choices: branchs,
      }]).then(function(answers) {
          if (curBranch !== answers.line) {
              options.assetsDir = md5(answers.line)
              warn(
                  `当前分支为${curBranch}，` +
                  `正在使用分支${answers.line}的版本号：${options.assetsDir} 进行构建\n`
              )
          }
      });

      

    } else { // TODO: 手动传入了branch,无需再去获取
        console.log(`👋 Hello, ${args.branch}!`);
        curBranch = args.branch
        options.assetsDir = md5(args.branch)
        warn(
            `当前分支为${args.branch}，` +
            `正在使用分支${args.branch}的版本号：${options.assetsDir} 进行构建\n`
        )
    }

    if (!args.envs) {
        await prompt([{
            type: 'list',
            message: 'Please select you deploy environment',
            name: 'line',
            choices: envs,
        }]).then(function(answers) {
            // const { line: env } = answers
            // injectEnvInfo(env, curBranch)
        });
    } else {// TODO: envs, 无需再去获取
        console.log(`👋 Hello, ${args.envs}!`);
        // injectEnvInfo(args.envs, args.branch)
    }

    for (const key in defaults) {
      if (args[key] == null) {
        args[key] = defaults[key]
      }
    }
    args.entry = args.entry || args._[0]
    if (args.target !== 'app') {
      args.entry = args.entry || 'src/App.vue'
    }

    process.env.VUE_CLI_BUILD_TARGET = args.target

    const { log, execa } = require('@vue/cli-shared-utils')
    const { allProjectTargetsSupportModule } = require('../../util/targets')

    let needsDifferentialLoading = args.target === 'app' && args.module
    if (allProjectTargetsSupportModule) {
      log(
        `All browser targets in the browserslist configuration have supported ES module.\n` +
        `Therefore we don't build two separate bundles for differential loading.\n`
      )
      needsDifferentialLoading = false
    }

    args.needsDifferentialLoading = needsDifferentialLoading
    if (!needsDifferentialLoading) {
      await build(args, api, options)
      return
    }

    process.env.VUE_CLI_MODERN_MODE = true
    if (!process.env.VUE_CLI_MODERN_BUILD) {
      // main-process for legacy build
      const legacyBuildArgs = { ...args, moduleBuild: false, keepAlive: true }
      await build(legacyBuildArgs, api, options)

      // spawn sub-process of self for modern build
      const cliBin = require('path').resolve(__dirname, '../../../bin/vue-cli-service.js')
      await execa('node', [cliBin, 'build', ...rawArgs], {
        stdio: 'inherit',
        env: {
          VUE_CLI_MODERN_BUILD: true
        }
      })
    } else {
      // sub-process for modern build
      const moduleBuildArgs = { ...args, moduleBuild: true, clean: false }
      await build(moduleBuildArgs, api, options)
    }
  })
}

async function build (args, api, options) {
  const fs = require('fs-extra')
  const path = require('path')
  const webpack = require('webpack')
  const { chalk } = require('@vue/cli-shared-utils')
  const formatStats = require('./formatStats')
  const Config = require('webpack-chain')
  const internationBuild = require('./internationBuild')
  const createJsonFile = require('../../util/createJsonFile')
  const forceCodeReview = require('../../util/forceCodeReview')
  const validateWebpackConfig = require('../../util/validateWebpackConfig')
  const deleteDirectory = require('../../util/deleteDirectory')
  const {
    log,
    done,
    info,
    logWithSpinner,
    stopSpinner
  } = require('@vue/cli-shared-utils')

  if(!options.skipCodeReview) {
    const result = await forceCodeReview()
    if (!result) { process.exit(1) }
  }
  console.log("start building")
  const webpackConfigClass = new Config()
  if(typeof options.hooks.before === 'function') {
      options.hooks.before(webpackConfigClass)
  }
  log()
  const mode = api.service.mode
  if (args.target === 'app') {
    const bundleTag = args.needsDifferentialLoading
      ? args.moduleBuild
        ? `module bundle `
        : `legacy bundle `
      : ``
    logWithSpinner(`Building ${bundleTag}for ${mode}...`)
  } else {
    const buildMode = buildModes[args.target]
    if (buildMode) {
      const additionalParams = buildMode === 'library' ? ` (${args.formats})` : ``
      logWithSpinner(`Building for ${mode} as ${buildMode}${additionalParams}...`)
    } else {
      throw new Error(`Unknown build target: ${args.target}`)
    }
  }

  if (args.dest) {
    // Override outputDir before resolving webpack config as config relies on it (#2327)
    options.outputDir = args.dest
  }

  const targetDir = api.resolve(options.outputDir)
  const isLegacyBuild = args.needsDifferentialLoading && !args.moduleBuild

  // resolve raw webpack config
  let webpackConfig
  if (args.target === 'lib') {
    webpackConfig = require('./resolveLibConfig')(api, args, options)
  } else if (
    args.target === 'wc' ||
    args.target === 'wc-async'
  ) {
    webpackConfig = require('./resolveWcConfig')(api, args, options)
  } else {
    webpackConfig = require('./resolveAppConfig')(api, args, options)
  }

  // check for common config errors
  validateWebpackConfig(webpackConfig, api, options, args.target)

  if (args.watch) {
    modifyConfig(webpackConfig, config => {
      config.watch = true
    })
  }

  if (args.stdin) {
    process.stdin.on('end', () => {
      process.exit(0)
    })
    process.stdin.resume()
  }

  // Expose advanced stats
  if (args.dashboard) {
    const DashboardPlugin = require('../../webpack/DashboardPlugin')
    modifyConfig(webpackConfig, config => {
      config.plugins.push(new DashboardPlugin({
        type: 'build',
        moduleBuild: args.moduleBuild,
        keepAlive: args.keepAlive
      }))
    })
  }

  if (args.report || args['report-json']) {
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
    modifyConfig(webpackConfig, config => {
      const bundleName = args.target !== 'app'
        ? config.output.filename.replace(/\.js$/, '-')
        : isLegacyBuild ? 'legacy-' : ''
      config.plugins.push(new BundleAnalyzerPlugin({
        logLevel: 'warn',
        openAnalyzer: false,
        analyzerMode: args.report ? 'static' : 'disabled',
        reportFilename: `${bundleName}report.html`,
        statsFilename: `${bundleName}report.json`,
        generateStatsFile: !!args['report-json']
      }))
    })
  }

  if (args.clean) {
    await fs.emptyDir(targetDir)
  }

  return new Promise((resolve, reject) => {
    webpack(webpackConfig, (err, stats) => {
      stopSpinner(false)
      if (err) {
        return reject(err)
      }

      if (stats.hasErrors()) {
        return reject(new Error('Build failed with errors.'))
      }

      if (!args.silent) {
        const targetDirShort = path.relative(
          api.service.context,
          targetDir
        )
        const formatStatsInfo = formatStats(stats, targetDirShort, api, options)
        let domainList = []
        if(options.domainList && options.domainList.length) {
            domainList = options.domainList.filter(item => {
                return item.isBuild === true
            })
        }
        const staticPathInfo =  domainList.length ? path.join(targetDirShort, options.assetsDir + '/staticPath.json') : path.join(targetDirShort, '/staticPath.json')
        const configPathInfo = path.join(targetDirShort, options.assetsDir + '/config.json')
        log('  files\n')
        log(formatStatsInfo.logInfo)
        log('    config\n')
        createJsonFile(configPathInfo, formatStatsInfo.configInfo)
        createJsonFile(staticPathInfo, formatStatsInfo.staticPathInfo)
        domainList.length && internationBuild(targetDirShort, options, domainList)
        if (args.target === 'app' && !isLegacyBuild) {
          if (!args.watch) {
            if(!options.hooks.after && domainList.length) {
              deleteDirectory(path.join(targetDirShort, options.assetsDir))
            }
            done(`Build complete. The ${chalk.cyan(targetDirShort)} directory is ready to be deployed.`)
          } else {
            done(`Build complete. Watching for changes...`)
          }
        }
        if(typeof options.hooks.after === 'function') {
          options.hooks.after(webpackConfigClass)
        }
      }

      // test-only signal
      if (process.env.VUE_CLI_TEST) {
        console.log('Build complete.')
      }

      resolve()
    })
  })
}

module.exports.defaultModes = {
  build: 'production'
}
