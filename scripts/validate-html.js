#!/usr/bin/env node
/**
 * HTML 规则校验工具
 * 用于检查 HTML 文件是否符合编码规范
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// 校验规则
const rules = [
  {
    id: 'script-closed',
    name: 'Script 标签闭合',
    description: '所有 <script> 标签必须正确闭合',
    check: checkScriptTags
  },
  {
    id: 'link-closed',
    name: 'Link 标签闭合',
    description: '所有 <link> 标签必须是自闭合或正确闭合',
    check: checkLinkTags
  },
  {
    id: 'meta-closed',
    name: 'Meta 标签闭合',
    description: '所有 <meta> 标签必须是自闭合',
    check: checkMetaTags
  }
];

/**
 * 规则 1: 检查 script 标签是否闭合
 */
function checkScriptTags(content, filePath) {
  const errors = [];
  const warnings = [];
  
  // 匹配所有 script 标签（包括自闭合和非自闭合）
  const scriptTags = content.match(/<script[^>]*>/gi) || [];
  const closingTags = content.match(/<\/script>/gi) || [];
  
  // 统计数量
  const openCount = scriptTags.length;
  const closeCount = closingTags.length;
  
  if (openCount !== closeCount) {
    errors.push({
      rule: 'script-closed',
      message: `发现 ${openCount} 个 <script> 开始标签，但只有 ${closeCount} 个 </script> 结束标签`,
      line: findLineNumber(content, '<script')
    });
  }
  
  // 检查每个 script 标签是否有对应的闭合标签
  scriptTags.forEach((tag, index) => {
    // 检查是否是自闭合标签（不应该）
    if (tag.endsWith('/>')) {
      warnings.push({
        rule: 'script-closed',
        message: `Script 标签不应使用自闭合语法：${tag}`,
        line: findLineNumber(content, tag)
      });
    }
  });
  
  // 检查是否有未闭合的 script 标签
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const matchedScripts = content.match(scriptPattern) || [];
  
  if (matchedScripts.length < openCount) {
    const unClosedCount = openCount - matchedScripts.length;
    errors.push({
      rule: 'script-closed',
      message: `发现 ${unClosedCount} 个未闭合的 <script> 标签`,
      line: findLineNumber(content, '<script')
    });
  }
  
  return { errors, warnings };
}

/**
 * 规则 2: 检查 link 标签
 */
function checkLinkTags(content, filePath) {
  const errors = [];
  const warnings = [];
  
  // link 标签应该是自闭合的
  const linkTags = content.match(/<link[^>]*>/gi) || [];
  
  linkTags.forEach(tag => {
    // 检查是否有对应的闭合标签（不应该有）
    if (!tag.endsWith('/>') && !tag.endsWith('>')) {
      warnings.push({
        rule: 'link-closed',
        message: `Link 标签格式异常：${tag}`,
        line: findLineNumber(content, tag)
      });
    }
  });
  
  return { errors, warnings };
}

/**
 * 规则 3: 检查 meta 标签
 */
function checkMetaTags(content, filePath) {
  const errors = [];
  const warnings = [];
  
  const metaTags = content.match(/<meta[^>]*>/gi) || [];
  
  metaTags.forEach(tag => {
    // meta 标签应该是自闭合的
    if (!tag.endsWith('/>') && !tag.endsWith('>')) {
      warnings.push({
        rule: 'meta-closed',
        message: `Meta 标签格式异常：${tag}`,
        line: findLineNumber(content, tag)
      });
    }
  });
  
  return { errors, warnings };
}

/**
 * 查找字符串在文件中的行号
 */
function findLineNumber(content, searchString) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * 校验单个 HTML 文件
 */
function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const results = {
    file: filePath,
    errors: [],
    warnings: []
  };
  
  rules.forEach(rule => {
    const result = rule.check(content, filePath);
    results.errors.push(...result.errors);
    results.warnings.push(...result.warnings);
  });
  
  return results;
}

/**
 * 递归查找目录中的所有 HTML 文件
 */
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || './public';
  
  console.log(`${colors.cyan}════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}   HTML 规则校验工具 v1.0${colors.reset}`);
  console.log(`${colors.cyan}════════════════════════════════════════${colors.reset}\n`);
  
  // 查找所有 HTML 文件
  const htmlFiles = findHtmlFiles(targetDir);
  
  if (htmlFiles.length === 0) {
    console.log(`${colors.yellow}⚠ 未在 ${targetDir} 中找到 HTML 文件${colors.reset}\n`);
    process.exit(0);
  }
  
  console.log(`${colors.blue}📁 校验目录：${path.resolve(targetDir)}${colors.reset}`);
  console.log(`${colors.blue}📄 找到 ${htmlFiles.length} 个 HTML 文件\n${colors.reset}`);
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  // 校验每个文件
  htmlFiles.forEach(filePath => {
    const result = validateFile(filePath);
    const relativePath = path.relative(process.cwd(), filePath);
    
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}📄 ${relativePath}${colors.reset}`);
    
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log(`  ${colors.green}✓ 通过所有校验${colors.reset}`);
    } else {
      // 显示错误
      result.errors.forEach(error => {
        console.log(`  ${colors.red}✗ [${error.rule}]${colors.reset} ${error.message}`);
        console.log(`    ${colors.yellow}第 ${error.line} 行${colors.reset}`);
      });
      
      // 显示警告
      result.warnings.forEach(warning => {
        console.log(`  ${colors.yellow}⚠ [${warning.rule}]${colors.reset} ${warning.message}`);
        console.log(`    ${colors.yellow}第 ${warning.line} 行${colors.reset}`);
      });
    }
    
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  });
  
  // 总结
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}📊 校验总结${colors.reset}`);
  console.log(`  文件总数：${htmlFiles.length}`);
  console.log(`  ${colors.red}错误数：${totalErrors}${colors.reset}`);
  console.log(`  ${colors.yellow}警告数：${totalWarnings}${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  // 退出码
  if (totalErrors > 0) {
    console.log(`${colors.red}❌ 校验失败，请修复错误后重新提交${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ 校验通过！${colors.reset}\n`);
    process.exit(0);
  }
}

// 导出函数（供其他模块使用）
module.exports = {
  validateFile,
  findHtmlFiles,
  rules
};

// 运行主函数
if (require.main === module) {
  main();
}
