import os
import re

def main():
    target_dir = os.path.join("frontend-src", "src", "components")
    if not os.path.exists(target_dir):
        print(f"Directory {target_dir} does not exist.")
        return

    # Mappings for generic tailwind classes to our custom semantic classes
    # We use regexes to safely replace entire words (e.g., text-slate-800 to text-medical-textMain)
    
    replacements = {
        # Backgrounds
        r'\bdark:bg-slate-900\b': 'bg-medical-darkBg',
        r'\bbg-slate-900\b': 'bg-medical-darkBg',
        r'\bdark:bg-slate-800\b': 'bg-medical-darkBg',
        r'\bbg-slate-800\b': 'bg-medical-darkBg',
        r'\bdark:bg-slate-950\b': 'bg-medical-darkBg',
        r'\bbg-slate-950\b': 'bg-medical-darkBg',
        r'\bdark:bg-slate-50\b': 'bg-medical-cardBg',
        r'\bbg-slate-50\b': 'bg-medical-cardBg',
        r'\bdark:bg-slate-100\b': 'bg-medical-cardBg',
        r'\bbg-slate-100\b': 'bg-medical-cardBg',
        r'\bbg-\[\#F4F6F9\]\b': 'bg-medical-darkBg',
        
        # Borders
        r'\bdark:border-slate-200\b': 'border-medical-borderBg',
        r'\bborder-slate-200\b': 'border-medical-borderBg',
        r'\bdark:border-slate-300\b': 'border-medical-borderBg',
        r'\bborder-slate-300\b': 'border-medical-borderBg',
        r'\bdark:border-white/5\b': 'border-medical-borderBg',
        r'\bdark:border-white/10\b': 'border-medical-borderBg',
        r'\bborder-white/10\b': 'border-medical-borderBg',
        r'\bborder-white/5\b': 'border-medical-borderBg',
        
        # Text Main
        r'\bdark:text-slate-800\b': 'text-medical-textMain',
        r'\btext-slate-800\b': 'text-medical-textMain',
        r'\bdark:text-slate-900\b': 'text-medical-textMain',
        r'\btext-slate-900\b': 'text-medical-textMain',
        r'\bdark:text-white\b': 'text-medical-textMain', 
        
        # Text Muted/Body
        r'\bdark:text-slate-500\b': 'text-medical-textMuted',
        r'\btext-slate-500\b': 'text-medical-textMuted',
        r'\bdark:text-slate-400\b': 'text-medical-textMuted',
        r'\btext-slate-400\b': 'text-medical-textMuted',
        r'\bdark:text-slate-600\b': 'text-medical-textBody',
        r'\btext-slate-600\b': 'text-medical-textBody',
        r'\bdark:text-slate-700\b': 'text-medical-textBody',
        r'\btext-slate-700\b': 'text-medical-textBody',
        r'\bdark:text-slate-300\b': 'text-medical-textBody',
        r'\btext-slate-300\b': 'text-medical-textBody',
        
        # Accents
        r'\bdark:text-blue-500\b': 'text-medical-indigo',
        r'\btext-blue-500\b': 'text-medical-indigo',
        r'\bdark:text-blue-600\b': 'text-medical-indigo',
        r'\btext-blue-600\b': 'text-medical-indigo',
        r'\bdark:bg-blue-500\b': 'bg-medical-indigo',
        r'\bbg-blue-500\b': 'bg-medical-indigo',
        r'\bdark:bg-blue-600\b': 'bg-medical-indigo',
        r'\bbg-blue-600\b': 'bg-medical-indigo',
        r'\bbg-blue-500/10\b': 'bg-medical-indigo/10',
        r'\bshadow-blue-500/15\b': 'shadow-medical-indigo/15',
        r'\bshadow-blue-500/20\b': 'shadow-medical-indigo/20',
        r'\bborder-blue-500\b': 'border-medical-indigo',
        
        # Teal (Secondary)
        r'\bdark:text-teal-500\b': 'text-medical-teal',
        r'\btext-teal-500\b': 'text-medical-teal',
        r'\bdark:text-teal-600\b': 'text-medical-teal',
        r'\btext-teal-600\b': 'text-medical-teal',
        r'\bdark:bg-teal-500\b': 'bg-medical-teal',
        r'\bbg-teal-500\b': 'bg-medical-teal',
        r'\bdark:bg-teal-600\b': 'bg-medical-teal',
        r'\bbg-teal-600\b': 'bg-medical-teal',
        r'\bborder-teal-500\b': 'border-medical-teal',
    }

    # Files to exclude (like Auth.jsx which we already did manually)
    exclude_files = ["Auth.jsx", "index.css"]

    modified_files = 0
    
    for root, _, files in os.walk(target_dir):
        for file in files:
            if not file.endswith(".jsx"):
                continue
            if file in exclude_files:
                continue
                
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                
            original_content = content
            
            for pattern, replacement in replacements.items():
                content = re.sub(pattern, replacement, content)
                
            # specific cleanup 
            content = re.sub(r'\bdark:bg-slate-900/40\b', 'bg-medical-darkBg', content)
            content = re.sub(r'\bdark:bg-slate-900/50\b', 'bg-medical-darkBg', content)
            
            # Since semantic colors automatically handle dark mode via css variables, we can also remove empty dark: prefixes if they got orphaned
            # But the regex above replaces the entire `dark:bg-slate-900` with `bg-medical-darkBg`, so we should be good.

            if content != original_content:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                modified_files += 1
                print(f"Updated {file}")
                
    print(f"Complete. Modified {modified_files} files.")

if __name__ == "__main__":
    main()
