/**

 * @param className 
 * @param utilityClasses 
 * @returns 
 */
export function createCssRule(className: string, utilityClasses: string): string {

    const cleanUtilityClasses = utilityClasses.trim().replace(/\s+/g, ' ');
    return `\n.${className} {\n  @apply ${cleanUtilityClasses};\n}\n`;
}