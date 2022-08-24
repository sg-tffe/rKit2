const util = require('util')
const { error } = require('@vue/cli-shared-utils')
const exec = util.promisify(require('child_process').exec)


module.exports.getBuildBranch = async() => {
  const {stdout: originRaw } = await exec(`git branch --sort=-committerdate`)
  return originRaw.split(/[\s\n]/).filter(branch => {
    return ['', 'sort', '*'].indexOf(branch) === -1
  })
}

module.exports.getCurBranch = async() => {
  try {
    const {stdout: originRaw } = await exec(`git symbolic-ref --short -q HEAD`)
    return originRaw.replace('\n', '')
  } catch (err) {
    error(`请使用 git checkout branch 切换分支，git checkout origin/branch 无法切换到准确的分支.`) 
    process.exit(1)
  }
}