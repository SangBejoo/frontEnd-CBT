export function sanitizeHtml(value: string): string {
  if (!value) {
    return '';
  }

  if (typeof window === 'undefined') {
    return value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  }

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(value, 'text/html');

  documentFragment
    .querySelectorAll('script,style,iframe,object,embed,link[rel="stylesheet"]')
    .forEach((node) => node.remove());

  documentFragment.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const currentValue = attribute.value.trim();

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }

      if ((name === 'href' || name === 'src') && /^javascript:/i.test(currentValue)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (name === 'style') {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return documentFragment.body.innerHTML;
}

export function plainTextFromHtml(value: string): string {
  if (!value) {
    return '';
  }

  if (typeof window === 'undefined') {
    return value.replace(/<[^>]*>/g, ' ');
  }

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(value, 'text/html');
  return documentFragment.body.textContent || '';
}

export function hasRenderableHtml(value: string): boolean {
  return plainTextFromHtml(value).trim().length > 0;
}
