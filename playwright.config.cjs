const {defineConfig}=require(process.env.PLAYWRIGHT_TEST_MODULE||'@playwright/test');
module.exports=defineConfig({testDir:'./tests',testMatch:'v4.spec.cjs',workers:1,fullyParallel:false,timeout:120000,expect:{timeout:10000},use:{headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},reporter:[['list'],['html',{open:'never'}]]});
