export function exportFileStem(name: string): string {
  const withoutExtension = name.trim().replace(/\.(json|png)$/i, '')
  const safe = [...withoutExtension]
    .filter((char) => char.charCodeAt(0) >= 32 && !/[<>:"/\\|?*]/.test(char))
    .join('')
    .replace(/[. ]+$/g, '')
    .slice(0, 120)
  return safe || 'mindmap'
}
