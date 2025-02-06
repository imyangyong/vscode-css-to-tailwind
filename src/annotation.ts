import type { DecorationOptions, Disposable, TextEditor } from 'vscode'
import type { ContextLoader } from './contextLoader'
import path from 'path'
import { DecorationRangeBehavior, MarkdownString, Range, window, workspace } from 'vscode'
// import { getMatchedPositionsFromDoc } from './getMatched'
import { transformCss, transformStyle } from 'transform-to-tailwind'

import { log } from './log'
import { throttle } from './utils'

export async function registerAnnotations(
  loader: ContextLoader,
) {
  const disposals: Disposable[] = []

  const UnderlineDecoration = window.createTextEditorDecorationType({
    textDecoration: 'none; border-bottom: 1px dashed currentColor',
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  })

  const NoneDecoration = window.createTextEditorDecorationType({
    textDecoration: 'none',
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  })

  const borderRadius = '50%'
  const colorDecoration = window.createTextEditorDecorationType({
    before: {
      width: '0.9em',
      height: '0.9em',
      contentText: ' ',
      border: '1px solid',
      margin: `auto 0.2em auto 0;vertical-align: middle;border-radius: ${borderRadius};`,
    },
    dark: {
      before: {
        borderColor: '#eeeeee50',
      },
    },
    light: {
      before: {
        borderColor: '#00000050',
      },
    },
  })

  async function updateAnnotation(editor = window.activeTextEditor) {
    try {
      log.appendLine('updateAnnotation')
      const doc = editor?.document
      if (!doc)
        return reset(editor)

      const id = doc.uri.fsPath

      const code = doc.getText()
      if (!code)
        return reset(editor)

      log.appendLine(code)

      const result = await transformStyle(code)

      const colorRanges: DecorationOptions[] = []

      const remToPxRatio = -1

      // const positions = await getMatchedPositionsFromDoc(result, doc)

      const ranges: DecorationOptions[] = []

      editor.setDecorations(colorDecoration, colorRanges)

      editor.setDecorations(NoneDecoration, [])
      editor.setDecorations(UnderlineDecoration, ranges)
      // if (config.underline) {
      //   editor.setDecorations(NoneDecoration, [])
      //   editor.setDecorations(UnderlineDecoration, ranges)
      // }
      // else {
      //   editor.setDecorations(UnderlineDecoration, [])
      //   editor.setDecorations(NoneDecoration, ranges)
      // }
    }
    catch (e: any) {
      log.appendLine('⚠️ Error on annotation')
      log.appendLine(String(e.stack ?? e))
    }
  }

  function reset(editor?: TextEditor) {
    editor?.setDecorations(UnderlineDecoration, [])
    editor?.setDecorations(NoneDecoration, [])
    editor?.setDecorations(colorDecoration, [])
  }

  const throttledUpdateAnnotation = throttle(updateAnnotation, 200)

  disposals.push(window.onDidChangeActiveTextEditor(updateAnnotation))
  disposals.push(workspace.onDidChangeTextDocument((e) => {
    if (e.document === window.activeTextEditor?.document)
      throttledUpdateAnnotation()
  }))

  await updateAnnotation()
}
