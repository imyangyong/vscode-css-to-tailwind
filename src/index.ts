import type { TextEditorDecorationType, ExtensionContext, DecorationRenderOptions } from 'vscode'
import * as vscode from 'vscode'
import { log } from './log'
import { workspace } from 'vscode'
import { CssToTailwindProcess } from './process'
import { LRUCache } from '@imyangyong/utils'
import { version } from './generated/meta'

function createStyle(options: DecorationRenderOptions) {
  return vscode.window.createTextEditorDecorationType({ rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed, ...options })
}

function createPosition(pos: [number, number]): vscode.Position {
  return new vscode.Position(pos[0], pos[1])
}

function createRange(start: [number, number], end: [number, number]): vscode.Range {
  return new vscode.Range(createPosition(start), createPosition(end))
}

const cacheMap = new LRUCache(5000)
export let decorationType: TextEditorDecorationType
export async function activate(context: ExtensionContext) {
  log.appendLine(`⚪️ Css To Tailwind for VS Code v${version}\n`)

  const config = workspace.getConfiguration('CssToTailwind')
  const disabled = config.get<boolean>('disable', false)
  if (disabled) {
    log.appendLine('➖ Disabled by configuration')
    return
  }
  const process = new CssToTailwindProcess()
  const LANS = ['html', 'javascriptreact', 'typescript', 'typescriptreact', 'vue', 'svelte', 'solid', 'swan', 'react', 'js', 'ts', 'tsx', 'jsx', 'wxml', 'axml', 'css', 'wxss', 'acss', 'less', 'scss', 'sass', 'stylus', 'wxss', 'acss']
  const md = new vscode.MarkdownString()
  md.isTrusted = true
  md.supportHtml = true
  const style = {
    dark: {
      textDecoration: 'none; border-bottom: 1px dashed currentColor',
    },
    light: {
      textDecoration: 'none; border-bottom: 1px dashed currentColor',
    },
  }
  decorationType = createStyle(style)

  // 移除装饰器
  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(() => vscode.window.activeTextEditor?.setDecorations(decorationType, [])))
  context.subscriptions.push(vscode.window.onDidChangeTextEditorVisibleRanges(() => {
    vscode.window.activeTextEditor?.setDecorations(decorationType, [])
  }))
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(({ reason, contentChanges, document }) => {
    if (document.languageId === 'Log' || !contentChanges.length)
      return
    vscode.window.activeTextEditor?.setDecorations(decorationType, [])
  }))

  let disposable = vscode.commands.registerCommand('CssToTailwind.copyToClipboard', (text) => {
    const decodedText = decodeURIComponent(text)
    vscode.env.clipboard.writeText(decodedText)
    vscode.window.showInformationMessage(`已复制到剪贴板: ${decodedText}`)
  });
  context.subscriptions.push(disposable);

  // style to tailwind hover事件
  context.subscriptions.push(vscode.languages.registerHoverProvider(LANS, {
    provideHover(document, position) {
    // 获取当前选中的文本范围
    const editor = vscode.window.activeTextEditor
    if (!editor)
      return
    // 移除样式
    editor.setDecorations(decorationType, [])
    let realRange: { content: string, range: vscode.Range } | undefined
    const range = document.getWordRangeAtPosition(position) as any
    if (!range)
      return
    let word = document.getText(range)
    if (!word)
      return
    const line = range.c.c
    const lineNumber = position.line
    const lineText = document.lineAt(lineNumber).text
    if (lineText.indexOf(':') < 1)
      return
    const wholeReg = new RegExp(`([\\w\\-]+\\s*:\\s)?([\\w\\-\\[\\(\\!]+)?${word}(:*\\s*[^:"}{\`;>]+)?`, 'g')
    for (const match of lineText.matchAll(wholeReg)) {
      log.appendLine(JSON.stringify(match))
      const { index } = match
      const pos = index! + match[0].indexOf(word)
      if (pos === range?.c?.e) {
        word = match[0]
        realRange = {
          content: match[0],
          range: createRange([line, index!], [line, index! + match[0].length]),
        }
        break
      }
    }
    const hoverText = word.replace(/'/g, '').trim()

    if (!hoverText || !/[\w\-]+\s*:[^.]+/.test(hoverText) || !realRange)
      return
    const key = `${hoverText}`
    if (cacheMap.has(key))
      return setStyle(cacheMap.get(key), [realRange.range])
    const hoverTailwindText = process.convert(hoverText)
    if (!hoverTailwindText)
      return
    // 设置缓存
    cacheMap.set(key, hoverTailwindText)

    return setStyle(hoverTailwindText, [realRange.range])
  }}))

  function setStyle(selectedTailwindText: string, rangeMap: vscode.Range[]) {
    md.value = ''
    // 增加decorationType样式
    vscode.window.activeTextEditor?.setDecorations(decorationType, rangeMap)

    const copyIcon = `<sub><img width='14' height='14' src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UyOWNkMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2Utd2lkdGg9IjEuNSI+PHBhdGggZD0iTTIwLjk5OCAxMGMtLjAxMi0yLjE3NS0uMTA4LTMuMzUzLS44NzctNC4xMjFDMTkuMjQzIDUgMTcuODI4IDUgMTUgNWgtM2MtMi44MjggMC00LjI0MyAwLTUuMTIxLjg3OUM2IDYuNzU3IDYgOC4xNzIgNiAxMXY1YzAgMi44MjggMCA0LjI0My44NzkgNS4xMjFDNy43NTcgMjIgOS4xNzIgMjIgMTIgMjJoM2MyLjgyOCAwIDQuMjQzIDAgNS4xMjEtLjg3OUMyMSAyMC4yNDMgMjEgMTguODI4IDIxIDE2di0xIi8+PHBhdGggZD0iTTMgMTB2NmEzIDMgMCAwIDAgMyAzTTE4IDVhMyAzIDAgMCAwLTMtM2gtNEM3LjIyOSAyIDUuMzQzIDIgNC4xNzIgMy4xNzJDMy41MTggMy44MjUgMy4yMjkgNC43IDMuMTAyIDYiLz48L2c+PC9zdmc+' /></sub>`
    const encodedText = encodeURIComponent(selectedTailwindText)
    md.appendMarkdown(`Css To Tailwind: **${selectedTailwindText}** <a href='command:CssToTailwind.copyToClipboard?${JSON.stringify([encodedText])}'>${copyIcon}</a>\n`)
    return new vscode.Hover(md)
  }
}

export function deactivate() {
  cacheMap.clear()
}
