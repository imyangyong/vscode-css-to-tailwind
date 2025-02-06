import { transformStyle } from 'transform-to-tailwind'
import { log } from './log'

export class CssToTailwindProcess {
  /**
   * transform multiple style to unocss
   *
   * @param {string} text origin text
   * @return {string} transformed text
   */
  convert(text: string) {
    const match = text.match(/style="([^"]+)"/)
    if (match)
      text = match[1]

    const selectedTexts = text.split(';').filter(i => i !== '"')
    let isChanged = false
    const selectedNewTexts = []
    for (let i = 0; i < selectedTexts.length; i++) {
      const text = selectedTexts[i]
      const newText = transformStyle(text).code === 'OK' ? transformStyle(text).data[0] : text
      log.appendLine(`${text} -> ${newText}`)
      log.appendLine(JSON.stringify(transformStyle(text)))
      if (!newText)
        continue
      if (!isChanged)
        isChanged = newText !== text
      selectedNewTexts.push(newText)
    }
    // 没有存在能够转换的元素
    if (!isChanged)
      return

    const selectedTailwindText = selectedNewTexts.join(' ')
    return selectedTailwindText
  }
}
