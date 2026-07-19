import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Simple replacements
    content = content.replace("list[", "List[")
    content = content.replace("dict[", "Dict[")
    content = content.replace("tuple[", "Tuple[")
    content = content.replace("type[", "Type[")
    
    # We replace 'X | None' with 'Optional[X]'
    # X can be e.g., 'str', 'int', 'List[Dict[str, Any]]', 'Detection'
    # Wait, simple regex might fail on nested brackets if not careful.
    # Python 3.9 typing allows List, Dict but not `|` union.
    # So we replace ` | None` with `Optional[...]`.
    
    # A robust way is to find ` | None` and the preceding type.
    # Since types can be complex, let's use a regex that handles word characters and brackets.
    # Regex: `([A-Za-z0-9_\[\],\. ]+?)\s*\|\s*None\b`
    
    # Run substitution multiple times to handle overlapping/nested if any (though unlikely for | None)
    for _ in range(3):
        content = re.sub(r'([A-Za-z0-9_\[\],\. "]+?)\s*\|\s*None\b', r'Optional[\1]', content)
        content = re.sub(r'\bNone\s*\|\s*([A-Za-z0-9_\[\],\. "]+)', r'Optional[\1]', content)

    # Some variables might be typed with `Type | Type2`. The issue only specified `str | None` etc., but if there are other unions `X | Y`, we'd need `Union[X, Y]`.
    # Searching for `|` used in typing:
    # Let's replace ` | ` with `, ` inside a Union? No, let's hope it's mostly `| None`.
    
    if content != original_content:
        # Need to ensure typing imports exist.
        typing_imports = []
        if "List[" in content: typing_imports.append("List")
        if "Dict[" in content: typing_imports.append("Dict")
        if "Tuple[" in content: typing_imports.append("Tuple")
        if "Type[" in content: typing_imports.append("Type")
        if "Optional[" in content: typing_imports.append("Optional")
        if "Any" in content: typing_imports.append("Any")
        if "Union" in content: typing_imports.append("Union")
        
        # Check existing imports from typing
        import_match = re.search(r'^from typing import (.*)$', content, re.MULTILINE)
        if import_match:
            existing_imports = [x.strip() for x in import_match.group(1).split(',')]
            for imp in typing_imports:
                if imp not in existing_imports:
                    existing_imports.append(imp)
            new_import_stmt = "from typing import " + ", ".join(existing_imports)
            content = content.replace(import_match.group(0), new_import_stmt)
        else:
            # Add to the top of the file, after `from __future__ import annotations` if present
            new_import_stmt = "from typing import " + ", ".join(typing_imports) + "\n"
            if "from __future__ import annotations" in content:
                content = content.replace("from __future__ import annotations\n", "from __future__ import annotations\n" + new_import_stmt)
            else:
                content = new_import_stmt + content
                
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

if __name__ == "__main__":
    app_dir = os.path.join(os.path.dirname(__file__), 'app')
    for root, _, files in os.walk(app_dir):
        for file in files:
            if file.endswith('.py'):
                process_file(os.path.join(root, file))
