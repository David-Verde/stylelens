import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';


export interface StyleUsage {
    classString: string;
    location: vscode.Range;
}


function normalizeClassString(classString: string): string {
    return classString.trim().split(/\s+/).sort().join(' ');
}

/**

 * @param fileContent 
 * @returns 
 */
export function findDuplicateClasses(fileContent: string): StyleUsage[] {
    try {
        // 1. Parsear el código a un AST
        const ast = parser.parse(fileContent, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'], 
        });

        const allClassUsages: StyleUsage[] = [];
        const classCounts = new Map<string, number>();

      
        traverse(ast, {
 
            JSXAttribute(path) {
          
                if (path.node.name.name === 'className' || path.node.name.name === 'class') {
                    const valueNode = path.node.value;
                    // Asegurarnos de que el valor es un string literal (ej: "texto")
                    if (valueNode?.type === 'StringLiteral' && valueNode.value && path.node.loc) {
                        const originalClassString = valueNode.value;
                        const normalizedClassString = normalizeClassString(originalClassString);
                        
             
                        const start = path.node.loc.start;
                        const end = path.node.loc.end;
                        const range = new vscode.Range(
                            new vscode.Position(start.line - 1, start.column),
                            new vscode.Position(end.line - 1, end.column)
                        );

                        allClassUsages.push({ classString: normalizedClassString, location: range });

                 
                        const count = classCounts.get(normalizedClassString) || 0;
                        classCounts.set(normalizedClassString, count + 1);
                    }
                }
            },
        });


        const duplicateClassStrings = new Set<string>();
        classCounts.forEach((count, classString) => {
            if (count > 1) {
                duplicateClassStrings.add(classString);
            }
        });


        return allClassUsages.filter(usage => duplicateClassStrings.has(usage.classString));

    } catch (error) {
        console.error("StyleLens: Error parsing JSX file.", error);
        return []; // Devolvemos un array vacío si hay un error de parseo
    }
}