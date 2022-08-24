#!/usr/bin/env node
const util = require('util')
const chalk = require('chalk')
const { info, error, warn } = require('@vue/cli-shared-utils')
const exec = util.promisify(require('child_process').exec)


function findRevesion(rawMsg) {
  const re = new RegExp('/D(\\w*)', 'g')
        msg = rawMsg.replace(/[\r\n]/g,'')
  const result = re.exec(msg)
  if (!result || !result[1]) { return null }
  return result[1]
}

async function findCommitRange(branch) {
  const {stdout: originRaw } = await exec(`git reflog show ${branch}`)
  const origin = originRaw.replace(/[\r\n]/g,''),
        re = new RegExp(`(\\w{7})\\s${branch}`, 'g');
  const commits = []
  while((commit = re.exec(origin)) !== null) {
    commits.push(commit[1])
  }
  return commits
}

async function checkReviewBy(revesionId) {
  let isReviewed = false,
      isSelfReviewed = false
  try {
    let { stdout: querydiffsout } = await exec(`echo '{
      "ids": [${revesionId}]
    }' | arc call-conduit differential.query`, {maxBuffer: Infinity})
    const data = JSON.parse(querydiffsout)
    if (data.response && data.response[0]) {
      const diffInfo = data.response[0]
      const { statusName, authorPHID, reviewers } = diffInfo
      isReviewed = statusName === 'Accepted'
      isSelfReviewed = reviewers.hasOwnProperty(authorPHID) && reviewers[authorPHID]
    }
  } catch (error) {
    console.log(chalk.red(`${error}`))
    throw new Error(error)
  }
  return {
    isReviewed,
    isSelfReviewed
  }
}

async function monitorUpdate(revesionId, lastCommit) {
  info(`匹配到DIFF版本：D${revesionId}\n`)
  try {
    let needUpdate = false
    let { stdout: querydiffsout } = await exec(`echo '{
      "ids": [${revesionId}]
    }' | arc call-conduit differential.query`, {maxBuffer: Infinity})
    const data = JSON.parse(querydiffsout)
    if (data.response && data.response[0]) {
      const hash = data.response[0].hashes
      const lastHash = hash[0][1] || ''
      needUpdate = lastHash.indexOf(lastCommit) === -1
    }
    return needUpdate

  } catch (err) {
    error(`${err}`)
    return
  }
}

async function detectMasterUpdate(branch) {
  try {
    let { stdout: orginMasterHash } = await exec(`git rev-parse --verify origin/master`)
    if(!orginMasterHash) {
      error('远端 master 不存在\n')
      return
    }
    await exec(`git fetch origin`)
    const { stdout: branchLog } = await exec(`git log --grep="${branch}"`, {maxBuffer: Infinity})
    if (branchLog.indexOf(`Merge branch '${branch}' into 'master'`) !== -1) {
      info('当前分支已上线！\n')
    }
    const getLostCommand = `git rev-list --left-right --count origin/master...${branch} | cut -f1`
    let { stdout: loseCommitCount } = await exec(getLostCommand)
    return Number.parseInt(loseCommitCount)
  } catch(error) {
    error('请检查远端仓库是否存在！\n')
    return
  }
}

async function forceCodeReview() {
  
  try {
    const {stdout: branchRaw } = await exec(`git status | grep 'On branch' | awk '{print $NF}'`)
    const branch = branchRaw.trim()
    if(branch.trim() === 'master') {
      return true
    }
    
    let revesionId = null,
        isReviewBy = false,
        isSelfReviewed = false
    const loseCommitCount = await detectMasterUpdate(branch)
    if(loseCommitCount > 0) {
      error(`当前分支落后 master ${loseCommitCount}个提交，请先merge master\n`)
      return
    }

    const commits = await findCommitRange(branch)

    for(let i = 0, len = commits.length; i < len; i++) {
      const commit = commits[i]
      let {stdout: commitRaw } = await exec(`git rev-list --format=%B --max-count=1 ${commit}`)
      if(commitRaw.indexOf('Differential Revision') !== -1) { // 已经创建cr
        revesionId = findRevesion(commitRaw)
        if (!isReviewBy && revesionId) {
          const reviewResult = await checkReviewBy(revesionId)
          isReviewBy = reviewResult.isReviewed
          isSelfReviewed = reviewResult.isSelfReviewed
          break
        }
      }
    }

    if (isReviewBy && revesionId) {
      const needUpdate = await monitorUpdate(revesionId, commits[0])
      if (needUpdate) {
        warn(`最新的修改暂未arc update 使用 arc diff master --update D${revesionId} 进行更新\n`)
      }
    }

    if(!isReviewBy) {
      error('进行code review是一个程序员的美德，请先进行code review\n')
      return
    }
    if(isReviewBy && isSelfReviewed) {
      error('请勿自行Accepted Diff哦！\n')
      return
    }
    return true
  } catch (err) {
    error(err)
    return false
  }
}

module.exports = forceCodeReview