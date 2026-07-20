/**
 * Safely set HTML content on an element using DOMParser
 * instead of innerHTML or insertAdjacentHTML.
 */
export function setSvgContent(el: HTMLElement, html: string): void {
  el.empty();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  while (body.firstChild) {
    el.appendChild(body.firstChild);
  }
}
