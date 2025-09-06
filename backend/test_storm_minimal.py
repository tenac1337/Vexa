import os
import sys
sys.path.insert(0, './venv/lib/python3.12/site-packages')

try:
    print("Testing imports...")
    from knowledge_storm import STORMWikiRunner
    print("✅ STORM imported successfully")
    
    from knowledge_storm.lm import LitellmModel  
    print("✅ LitellmModel imported successfully")
    
    print("Testing environment...")
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        print(f"✅ GOOGLE_API_KEY found: {api_key[:20]}...")
    else:
        print("❌ GOOGLE_API_KEY not found")
        
    print("Testing model creation...")
    model = LitellmModel(
        model='gemini/gemini-1.5-flash',
        max_tokens=100,
        api_key=api_key,
        temperature=1.0
    )
    print("✅ Model created successfully")
    
    print("Testing model call...")
    response = model.call("Hello, test message")
    print(f"✅ Model responded: {response[:100]}...")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
