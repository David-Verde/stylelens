import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

export interface StyleUsage {
    classString: string;
    location: vscode.Range;
}

export interface InlineStyleUsage {
    styleString: string;
    location: vscode.Range;
}

export function normalizeClassString(classString: string): string {
    return classString.trim().split(/\s+/).sort().join(' ');
}

export function normalizeStyleString(styleString: string): string {
    return styleString.split(';')
        .map(s => s.trim())
        .filter(s => s)
        .sort()
        .join('; ');
}

function getRangeFromLoc(loc: t.SourceLocation): vscode.Range {
    return new vscode.Range(
        new vscode.Position(loc.start.line - 1, loc.start.column),
        new vscode.Position(loc.end.line - 1, loc.end.column)
    );
}

export function findAllClassUsagesInJsx(fileContent: string): StyleUsage[] {
    try {
        const ast = parser.parse(fileContent, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
        const allClassUsages: StyleUsage[] = [];
      
        traverse(ast, {
            JSXAttribute(path) {
                if ((path.node.name.name === 'className' || path.node.name.name === 'class') && path.node.value?.type === 'StringLiteral' && path.node.value.value.trim() !== '') {
                    if (path.node.loc) {
                        allClassUsages.push({ 
                            classString: normalizeClassString(path.node.value.value), 
                            location: getRangeFromLoc(path.node.loc)
                        });
                    }
                }
            },
        });
        return allClassUsages;
    } catch (error) { 
        console.error("StyleLens: Error parsing JSX for classes.", error);
        return []; 
    }
}

export function findAllInlineStylesInJsx(fileContent: string): InlineStyleUsage[] {
    try {
        const ast = parser.parse(fileContent, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
        const allInlineStyles: InlineStyleUsage[] = [];

        traverse(ast, {
            JSXAttribute(path: NodePath<t.JSXAttribute>) {
                if (path.node.name.name === 'style' && path.node.value?.type === 'JSXExpressionContainer' && path.node.value.expression.type === 'ObjectExpression') {
                    const properties = path.node.value.expression.properties;
                    let styleString = '';
                    
                    for (const prop of properties) {
                        if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier' && (prop.value.type === 'StringLiteral' || prop.value.type === 'NumericLiteral')) {
                            const cssProperty = prop.key.name.replace(/([A-Z])/g, '-$1').toLowerCase();
                            const cssValue = prop.value.type === 'NumericLiteral' ? `${prop.value.value}px` : prop.value.value;
                            styleString += `${cssProperty}: ${cssValue}; `;
                        }
                    }

                    if (styleString && path.node.loc) {
                        allInlineStyles.push({
                            styleString: normalizeStyleString(styleString.trim()),
                            location: getRangeFromLoc(path.node.loc)
                        });
                    }
                }
            }
        });
        return allInlineStyles;
    } catch (error) { 
        console.error("StyleLens: Error parsing JSX for inline styles.", error);
        return []; 
    }
}

export function findDuplicateClasses(fileContent: string): StyleUsage[] {
    const allUsages = findAllClassUsagesInJsx(fileContent);
    const classCounts = new Map<string, number>();

    allUsages.forEach(usage => {
        const count = classCounts.get(usage.classString) || 0;
        classCounts.set(usage.classString, count + 1);
    });

    const duplicateClassStrings = new Set<string>();
    classCounts.forEach((count, classString) => { if (count > 1) duplicateClassStrings.add(classString); });

    return allUsages.filter(usage => duplicateClassStrings.has(usage.classString));
}