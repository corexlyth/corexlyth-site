// Raw HTML is displayed as text. Sanitization also strips unsafe Markdown URLs.
export function literalHtml(){return tree=>{function visit(node){if(node.type==='html'){node.type='text';}if(node.children)for(const child of node.children)visit(child);}visit(tree);};}
