'use strict';
const ora = require('ora')
const inquirer = require('inquirer');
const util = require('util')
const exec = util.promisify(require('child_process').exec)

module.exports = (api, options) => {
  api.registerCommand('init', {
    description: 'create a project',
  }, args => {
    const prompt = inquirer.createPromptModule();
    prompt([{
      type: 'list',
      message: 'Please select a template type',
      name: 'line',
      choices: ['vue3-h5-app', 'vue3-pc-app'],
    }]).then(function(answers) {
      pullVueTpl(
        answers.line,
        `https://github.com/sg-tffe/${answers.line}.git`
      )
    });
  })

  function pullVueTpl(tplName, gitUrl) {
    const spinner = new ora({});
    spinner.start(`创建${tplName}模版`);
    setTimeout(() => {
      spinner.color = 'yellow';
      spinner.text = `远程拉取${tplName}模版`;
    }, 1000);
    exec(`git clone ${gitUrl}`, function(err, stdout, stderr) {
      if (err) {
        spinner.fail(err)
      } else {
        spinner.succeed('创建成功')
        console.log('执行下面命令开始开发：');
        console.log('npm install && npm run dev');
        console.log(stdout, typeof stderr)
      }
      spinner.stop();
    })
  }
}