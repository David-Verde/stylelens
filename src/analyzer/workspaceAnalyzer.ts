import * as vscode from 'vscode';
import { findAllClassUsagesInJsx, findAllInlineStylesInJsx, StyleUsage, InlineStyleUsage } from './jsxParser';
import { findAllClassUsagesInVue, findAllInlineStylesInVue } from './vueParser';
import { findAllClassUsagesInSvelte } from './svelteParser';
import { getAllDefinedCssClasses } from './cssAnalyzer';
import * as path from 'path';
import * as fs from 'fs';

export interface SimpleLocation {
    start: { line: number; character: number };
    end: { line: number; character: number };
}

export interface WebviewDuplicateResult {
    classString: string;
    count: number;
    fullLocations: { filePath: string; location: SimpleLocation; }[];
}

export interface WebviewInlineStyleDuplicateResult {
    styleString: string;
    count: number;
    fullLocations: { filePath: string; location: SimpleLocation; }[];
}

export interface WebviewUndefinedClassResult {
    filePath: string;
    className: string;
    location: SimpleLocation;
}

export interface WebviewAnalysisReport {
    duplicates: WebviewDuplicateResult[];
    inlineStyleDuplicates: WebviewInlineStyleDuplicateResult[];
    undefinedClasses: WebviewUndefinedClassResult[];
    duplicateSummary: {
        critical: number;
        warning: number;
        normal: number;
    };
    classHeat: {
        hot: { className: string; count: number }[];
        warm: { className: string; count: number }[];
        normal: { className: string; count: number }[];
    };
    recommendations: WebviewDuplicateResult[];
}

let utilityClassesSet: Set<string> = new Set();

export function initializeUtilityClassSet(context: vscode.ExtensionContext) {
    try {
        const jsonPath = path.join(context.extensionPath, 'out', 'resources', 'tailwind-classes.json');
        const fileContent = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(fileContent);
        utilityClassesSet = new Set(data.classes);
    } catch (error) {
        console.error("StyleLens: No se pudo leer tailwind-classes.json.", error);
        utilityClassesSet = new Set();
    }
}

function isUtilityClass(className: string): boolean {
    if (!className) return true;
    const baseClassName = className.substring(className.lastIndexOf(':') + 1);
    if (utilityClassesSet.has(baseClassName)) return true;
    if (baseClassName.includes('[') && baseClassName.includes(']')) return true;
    return false;
}

export async function analyzeWorkspaceForWebview(): Promise<WebviewAnalysisReport> {
    const [definedCssClasses, componentFiles] = await Promise.all([
        getAllDefinedCssClasses(),
        vscode.workspace.findFiles('**/*.{jsx,tsx,vue,svelte}', '**/node_modules/**')
    ]);

    const usagesByClass = new Map<string, (StyleUsage & { filePath: string })[]>();
    const usagesByInlineStyle = new Map<string, (InlineStyleUsage & { filePath: string })[]>();
    const allUndefinedClasses: WebviewUndefinedClassResult[] = [];
    const checkedUndefinedClasses = new Set<string>();
    const individualClassCounts = new Map<string, number>();

    for (const file of componentFiles) {
        const document = await vscode.workspace.openTextDocument(file);
        const fileContent = document.getText();
        const relativePath = vscode.workspace.asRelativePath(file);
        
        let classUsages: StyleUsage[] = [];
        let inlineStyleUsages: InlineStyleUsage[] = [];

        switch (document.languageId) {
            case 'javascriptreact':
            case 'typescriptreact':
                classUsages = findAllClassUsagesInJsx(fileContent);
                inlineStyleUsages = findAllInlineStylesInJsx(fileContent);
                break;
            case 'vue':
                classUsages = findAllClassUsagesInVue(fileContent);
                inlineStyleUsages = findAllInlineStylesInVue(fileContent);
                break;
            case 'svelte':
                classUsages = findAllClassUsagesInSvelte(document);
                break;
        }

        classUsages.forEach(usage => {
            const usageWithFile = { ...usage, filePath: relativePath };
            if (!usagesByClass.has(usage.classString)) {
                usagesByClass.set(usage.classString, []);
            }
            usagesByClass.get(usage.classString)!.push(usageWithFile);

            usage.classString.split(/\s+/).forEach(className => {
                if (className && !isUtilityClass(className)) {
                    const count = individualClassCounts.get(className) || 0;
                    individualClassCounts.set(className, count + 1);
                }
                const uniqueKey = `${className}@${relativePath}@${usage.location.start.line}`;
                if (className && !isUtilityClass(className) && !definedCssClasses.has(className) && !checkedUndefinedClasses.has(uniqueKey)) {
                    allUndefinedClasses.push({ 
                        filePath: relativePath, 
                        className, 
                        location: { 
                            start: { line: usage.location.start.line, character: usage.location.start.character }, 
                            end: { line: usage.location.end.line, character: usage.location.end.character }
                        } 
                    });
                    checkedUndefinedClasses.add(uniqueKey);
                }
            });
        });

        inlineStyleUsages.forEach(usage => {
            const usageWithFile = { ...usage, filePath: relativePath };
            if (!usagesByInlineStyle.has(usage.styleString)) {
                usagesByInlineStyle.set(usage.styleString, []);
            }
            usagesByInlineStyle.get(usage.styleString)!.push(usageWithFile);
        });
    }

    const duplicateResults: WebviewDuplicateResult[] = [];
    usagesByClass.forEach((locations, classString) => {
        if (locations.length > 1) {
            duplicateResults.push({ 
                classString, 
                count: locations.length, 
                fullLocations: locations.map(loc => ({ 
                    filePath: loc.filePath, 
                    location: { 
                        start: loc.location.start, 
                        end: loc.location.end 
                    } 
                })) 
            });
        }
    });

    const inlineStyleDuplicateResults: WebviewInlineStyleDuplicateResult[] = [];
    usagesByInlineStyle.forEach((locations, styleString) => {
        if (locations.length > 1) {
            inlineStyleDuplicateResults.push({ 
                styleString, 
                count: locations.length, 
                fullLocations: locations.map(loc => ({ 
                    filePath: loc.filePath, 
                    location: { 
                        start: loc.location.start, 
                        end: loc.location.end 
                    } 
                })) 
            });
        }
    });

    const duplicateSummary = { critical: 0, warning: 0, normal: 0 };
    [...duplicateResults, ...inlineStyleDuplicateResults].forEach(item => {
        if (item.count >= 5) duplicateSummary.critical++;
        else if (item.count >= 3) duplicateSummary.warning++;
        else duplicateSummary.normal++;
    });

    const sortedClasses = Array.from(individualClassCounts.entries()).sort((a, b) => b[1] - a[1]);
    const classHeat = {
        hot: sortedClasses.slice(0, 5).map(c => ({ className: c[0], count: c[1] })),
        warm: sortedClasses.slice(5, 15).map(c => ({ className: c[0], count: c[1] })),
        normal: sortedClasses.slice(15, 30).map(c => ({ className: c[0], count: c[1] })),
    };
    
    const recommendations = duplicateResults.filter(d => d.count >= 5);

    return {
        duplicates: duplicateResults.sort((a, b) => b.count - a.count),
        inlineStyleDuplicates: inlineStyleDuplicateResults.sort((a, b) => b.count - a.count),
        undefinedClasses: allUndefinedClasses,
        duplicateSummary,
        classHeat,
        recommendations
    };
}