# process_message.py
# Purpose: Load pre-trained Intent and NER models and process a message.

import json
import re
import os
import torch # Needed for checking CUDA availability and device setting in pipeline
from transformers import pipeline

# --- 1. Define Paths to FINAL Models ---
# These paths should point to where train_models.py saved the final models.
FINAL_INTENT_MODEL_DIR = "./final_model/intent_classifier"
FINAL_NER_MODEL_DIR = "./final_model/ner_model"

# --- 2. Check if Model Directories Exist ---
if not os.path.isdir(FINAL_INTENT_MODEL_DIR):
    print(f"Error: Intent model directory not found at '{FINAL_INTENT_MODEL_DIR}'")
    print("Please ensure you have run the 'train_models.py' script successfully first.")
    exit()
if not os.path.isdir(FINAL_NER_MODEL_DIR):
    print(f"Error: NER model directory not found at '{FINAL_NER_MODEL_DIR}'")
    print("Please ensure you have run the 'train_models.py' script successfully first.")
    exit()

# --- 3. Load Pipelines (Do this once at the start) ---
try:
    print("--- Loading Pipelines ---")
    # Determine device: Use GPU 0 if available, otherwise CPU
    device_to_use = 0 if torch.cuda.is_available() else -1
    device_name = "GPU" if device_to_use == 0 else "CPU"
    print(f"Attempting to load models on: {device_name}")

    print("Loading intent classification pipeline...")
    intent_classifier = pipeline(
        "text-classification",
        model=FINAL_INTENT_MODEL_DIR,
        tokenizer=FINAL_INTENT_MODEL_DIR, # Good practice to specify tokenizer explicitly
        device=device_to_use
    )

    print("Loading NER pipeline...")
    ner_pipeline = pipeline(
        "token-classification",
        model=FINAL_NER_MODEL_DIR,
        tokenizer=FINAL_NER_MODEL_DIR, # Good practice to specify tokenizer explicitly
        aggregation_strategy="simple", # Groups B-TAG/I-TAG into single entities
        device=device_to_use
    )
    print("Pipelines loaded successfully.")
    # Verify device (pipeline might override if model config forces CPU/GPU)
    print(f"Intent classifier running on: {intent_classifier.device}")
    print(f"NER pipeline running on: {ner_pipeline.device}")

except Exception as e:
    print(f"Error loading models: {e}")
    print("Please ensure the model paths are correct, models are downloaded/trained,")
    print("and required libraries (like torch, transformers) are installed.")
    exit()

# --- 4. Define the Parsing Function ---
def parse_user_message(message):
    """
    Parses a user message to extract intent and entities using pre-loaded pipelines.
    """
    print(f"\nProcessing message: '{message}'")
    try:
        # 1. Predict Intent
        intent_result = intent_classifier(message)[0] # Get the top prediction
        intent = intent_result['label']
        intent_confidence = intent_result['score'] # This might be float32
        print(f"  Intent: {intent} (Confidence: {intent_confidence:.4f})")

        # 2. Predict Entities
        ner_results = ner_pipeline(message)
        print(f"  Raw NER results: {ner_results}")

        # 3. Process & Structure Entities
        entities = {}
        for entity in ner_results:
            entity_type = entity['entity_group']
            entity_value = entity['word'].strip()
            entity_score = entity['score'] # This might be float32

            # Simple cleanup (can be expanded)
            entity_value = re.sub(r' ##', '', entity_value)
            entity_value = re.sub(r'\s+', ' ', entity_value).strip()

            if not entity_value:
                continue

            if entity_type not in entities:
                entities[entity_type] = []
            entities[entity_type].append({
                "text": entity_value,
                # --- FIX HERE: Cast to float ---
                "confidence": float(round(entity_score, 4)),
                # "start": entity['start'], # Optional
                # "end": entity['end'],     # Optional
            })

        print(f"  Processed Entities: {entities}")

        # 4. Combine results
        parsed_data = {
            "original_message": message,
            "intent": {
                "name": intent,
                # --- FIX HERE: Cast to float ---
                "confidence": float(round(intent_confidence, 4))
            },
            "entities": entities
        }
        return parsed_data

    except Exception as e:
        print(f"Error during parsing message '{message}': {e}")
        # Log the traceback for more details if needed
        import traceback
        traceback.print_exc()
        return {
            "original_message": message,
            "error": f"Failed to process message: {e}"
        }

# --- 5. Main Execution Logic ---
# ... (keep the rest of the script the same) ...

if __name__ == "__main__":
    input_filename = "message.txt"
    output_filename = "result.json"

    # --- Read message from input file ---
    try:
        print(f"\n--- Reading Message ---")
        print(f"Reading message from '{input_filename}'...")
        with open(input_filename, 'r', encoding='utf-8') as f:
            message_to_process = f.read().strip()

        if not message_to_process:
            print(f"Error: Input file '{input_filename}' is empty or contains only whitespace.")
            exit()

        print("Message read successfully.")

    except FileNotFoundError:
        print(f"Error: Input file '{input_filename}' not found.")
        print("Please create this file in the same directory as the script and add the message you want to parse.")
        exit()
    except Exception as e:
        print(f"An unexpected error occurred while reading '{input_filename}': {e}")
        exit()

    # --- Process the message using the function ---
    print("\n--- Processing Message ---")
    final_result = parse_user_message(message_to_process)

    # --- Write results to output JSON file ---
    if final_result and "error" not in final_result:
        try:
            print(f"\n--- Writing Results ---")
            print(f"Writing results to '{output_filename}'...")
            with open(output_filename, 'w', encoding='utf-8') as f:
                # Use ensure_ascii=False for broader character support, indent for readability
                json.dump(final_result, f, ensure_ascii=False, indent=4)
            print("Results successfully written.")
        except TypeError as e:
             # This specific catch might not be needed anymore, but good for debugging
             print(f"TypeError during JSON dump (should be fixed, but check data): {e}")
             print(f"Data attempting to dump: {final_result}")
        except Exception as e:
            print(f"An error occurred while writing to '{output_filename}': {e}")
    else:
        print("\n--- Skipping Writing Results Due to Processing Error ---")
        try:
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(final_result if final_result else {"error": "Unknown processing error"}, f, ensure_ascii=False, indent=4)
            print(f"Error details written to '{output_filename}'.")
        except Exception as e:
             print(f"An error occurred while writing error details to '{output_filename}': {e}")