#!/usr/bin/env python3
"""
STORM Research Script using Gemini Models (FIXED VERSION)
This script implements Stanford STORM for research with Gemini models
"""

import os
import sys
import json
import argparse
from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.lm import LitellmModel
from knowledge_storm.rm import BingSearch, YouRM, SerperRM, TavilySearchRM, DuckDuckGoSearchRM

def setup_gemini_models():
    """Setup Gemini models for STORM"""
    lm_configs = STORMWikiLMConfigs()
    
    gemini_kwargs = {
        'api_key': os.getenv("GOOGLE_API_KEY"),
        'temperature': 0.7,
        'top_p': 0.9,
    }
    
    # FIXED: Corrected model names for different components
    conv_simulator_lm = LitellmModel(
        model='gemini/gemini-1.5-flash', 
        max_tokens=500, 
        **gemini_kwargs
    )
    question_asker_lm = LitellmModel(
        model='gemini/gemini-1.5-flash', 
        max_tokens=500, 
        **gemini_kwargs
    )
    outline_gen_lm = LitellmModel(
        model='gemini/gemini-1.5-flash', 
        max_tokens=400, 
        **gemini_kwargs
    )
    article_gen_lm = LitellmModel(
        model='gemini/gemini-1.5-pro', 
        max_tokens=2500, 
        **gemini_kwargs
    )
    article_polish_lm = LitellmModel(
        model='gemini/gemini-1.5-pro', 
        max_tokens=2000, 
        **gemini_kwargs
    )
    
    lm_configs.set_conv_simulator_lm(conv_simulator_lm)
    lm_configs.set_question_asker_lm(question_asker_lm)
    lm_configs.set_outline_gen_lm(outline_gen_lm)
    lm_configs.set_article_gen_lm(article_gen_lm)
    lm_configs.set_article_polish_lm(article_polish_lm)
    
    return lm_configs

def setup_retrieval_module():
    """Setup retrieval module for information gathering"""
    search_engine = os.getenv("SEARCH_ENGINE", "duckduckgo")
    search_top_k = int(os.getenv("SEARCH_TOP_K", "3"))
    
    if search_engine == "bing" and os.getenv("BING_SEARCH_API_KEY"):
        return BingSearch(
            bing_search_api=os.getenv("BING_SEARCH_API_KEY"),
            k=search_top_k
        )
    elif search_engine == "you" and os.getenv("YDC_API_KEY"):
        return YouRM(
            ydc_api_key=os.getenv("YDC_API_KEY"),
            k=search_top_k
        )
    elif search_engine == "serper" and os.getenv("SERPER_API_KEY"):
        return SerperRM(
            serper_search_api_key=os.getenv("SERPER_API_KEY"),
            query_params={"autocorrect": True, "num": 10, "page": 1}
        )
    elif search_engine == "tavily" and os.getenv("TAVILY_API_KEY"):
        return TavilySearchRM(
            tavily_search_api_key=os.getenv("TAVILY_API_KEY"),
            k=search_top_k,
            include_raw_content=True
        )
    else:
        # Default to DuckDuckGo which doesn't require API key
        return DuckDuckGoSearchRM(
            k=search_top_k,
            safe_search="On",
            region="us-en"
        )

def run_storm_research(topic, output_dir="/tmp/storm_output"):
    """Run STORM research on a given topic"""
    try:
        print(f"Starting STORM research for: {topic}", flush=True)
        
        # Setup language models
        lm_configs = setup_gemini_models()
        print("Language models configured", flush=True)
        
        # Setup retrieval module
        rm = setup_retrieval_module()
        print("Retrieval module configured", flush=True)
        
        # OPTIMIZED: Fast mode configuration 
        engine_args = STORMWikiRunnerArguments(
            output_dir=output_dir,
            max_conv_turn=3,        # Reduced for speed
            max_perspective=3,      # Reduced for speed
            search_top_k=10,         # Reduced for speed
            max_thread_num=3        # Conservative to avoid rate limits
        )
        
        print("Creating STORM runner", flush=True)
        runner = STORMWikiRunner(engine_args, lm_configs, rm)
        
        print("Starting STORM research process", flush=True)
        runner.run(
            topic=topic,
            do_research=True,
            do_generate_outline=True,
            do_generate_article=True,
            do_polish_article=True  # Skip polishing for speed
        )
        
        print("Post-processing results", flush=True)
        runner.post_run()
        
        # Read the generated article
        topic_dir = topic.replace(" ", "_").replace("/", "_").replace("?", "")
        topic_path = os.path.join(output_dir, topic_dir)
        
        print(f"Looking for results in: {topic_path}", flush=True)
        
        # Try to find article file
        article_file = os.path.join(topic_path, "storm_gen_article.txt")
        if not os.path.exists(article_file):
            article_file = os.path.join(topic_path, "storm_gen_article_polished.txt")
        
        if os.path.exists(article_file):
            with open(article_file, 'r', encoding='utf-8') as f:
                article_content = f.read()
            print(f"Article loaded: {len(article_content)} characters", flush=True)
        else:
            article_content = "Article generation failed - no output file found"
            print(f"No article file found at: {article_file}", flush=True)
        
        # Read the outline
        outline_file = os.path.join(topic_path, "storm_gen_outline.txt")
        outline_content = ""
        if os.path.exists(outline_file):
            with open(outline_file, 'r', encoding='utf-8') as f:
                outline_content = f.read()
            print(f"Outline loaded: {len(outline_content)} characters", flush=True)
        
        # Read sources
        sources_file = os.path.join(topic_path, "url_to_info.json")
        sources = []
        if os.path.exists(sources_file):
            with open(sources_file, 'r', encoding='utf-8') as f:
                sources_data = json.load(f)
                sources = list(sources_data.keys()) if sources_data else []
            print(f"Sources loaded: {len(sources)} URLs", flush=True)
        
        result = {
            "success": True,
            "topic": topic,
            "article": article_content,
            "outline": outline_content,
            "sources": sources,
            "output_dir": topic_path
        }
        
        print("STORM research completed successfully!", flush=True)
        return result
        
    except Exception as e:
        error_msg = f"STORM research failed: {str(e)}"
        return {
            "success": False,
            "error": error_msg,
            "topic": topic
        }

def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(description='Run STORM research with Gemini models')
    parser.add_argument('topic', help='Research topic')
    parser.add_argument('--output-dir', default='/tmp/storm_output', help='Output directory')
    
    args = parser.parse_args()
    
    # Check for required environment variables
    if not os.getenv("GOOGLE_API_KEY"):
        error_result = {
            "success": False,
            "error": "GOOGLE_API_KEY environment variable is required"
        }
        print(json.dumps(error_result))
        sys.exit(1)
    
    # Run research
    result = run_storm_research(args.topic, args.output_dir)
    
    # Output result as JSON
    print(json.dumps(result))
    sys.stdout.flush() # Explicitly flush stdout
    sys.exit(0) # Explicitly exit with success code

if __name__ == "__main__":
    main() 