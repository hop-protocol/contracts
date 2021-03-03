require('dotenv').config()
import util from 'util'
import path from 'path'

const exec = util.promisify(require('child_process').exec)

async function main() {
  const networks = ['arbitrum', 'optimism', 'xdai']

  await execScript(`npm run deploy:l1-kovan`)
  await execScript(`npm run setup:l1-kovan`)

  for (let network of networks) {
    await execScript(`npm run deploy:l2-${network}`)
    await execScript(`npm run setup:l2-${network}`)
  }
}

async function execScript(cmd: string) {
  let {stdout, stderr} = await exec(cmd)
  if (stdout) {
    process.stdout.write(stdout)
  }
  if (stderr) {
    process.stderr.write(stderr)
  }
}

main()
.catch(error => {
  console.error(error)
})
.finally(() => process.exit(0))
