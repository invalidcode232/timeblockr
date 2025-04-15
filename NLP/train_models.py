# train_models.py
# Purpose: Load data, train Intent and NER models, save them for later use.

import os
import numpy as np
from datasets import load_dataset, Features, Value, ClassLabel
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    TrainingArguments,
    Trainer,
    DataCollatorForTokenClassification
)
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from seqeval.metrics import classification_report, f1_score
import torch # Still needed for model loading/device placement

# --- Configuration ---
BASE_MODEL_CHECKPOINT = "distilbert-base-uncased"
INTENT_DATA_TRAIN = 'intents_train.csv'
INTENT_DATA_TEST = 'intents_test.csv'
NER_DATA_TRAIN = 'ner_train.jsonl'
NER_DATA_TEST = 'ner_test.jsonl'

# Output directories
INTENT_OUTPUT_DIR = './results/intent_classifier_training' # Intermediate training outputs
NER_OUTPUT_DIR = './results/ner_model_training'           # Intermediate training outputs
FINAL_INTENT_MODEL_DIR = "./final_model/intent_classifier"
FINAL_NER_MODEL_DIR = "./final_model/ner_model"

# Ensure final directories exist
os.makedirs(FINAL_INTENT_MODEL_DIR, exist_ok=True)
os.makedirs(FINAL_NER_MODEL_DIR, exist_ok=True)

# Training parameters
INTENT_EPOCHS = 3
INTENT_BATCH_SIZE = 16
NER_EPOCHS = 5
NER_BATCH_SIZE = 16
MAX_LENGTH = 128 # Tokenizer max length

# --- 1. Load and Prepare Intent Data ---
print("--- Loading and Preparing Intent Data ---")
# Load temporarily to find unique labels
try:
    temp_intent_dataset = load_dataset('csv', data_files={'train': INTENT_DATA_TRAIN})
    unique_intent_labels = sorted(list(set(temp_intent_dataset['train']['label'])))
    print(f"Found Intent labels: {unique_intent_labels}")
except FileNotFoundError:
    print(f"Error: Intent training file '{INTENT_DATA_TRAIN}' not found.")
    exit()
except Exception as e:
    print(f"Error loading intent data: {e}")
    exit()


# Define the features, explicitly setting 'label' as ClassLabel
intent_features = Features({
    'text': Value('string'),
    'label': ClassLabel(names=unique_intent_labels)
})

# Reload the dataset using the defined features
intent_dataset = load_dataset('csv',
                              data_files={'train': INTENT_DATA_TRAIN, 'test': INTENT_DATA_TEST},
                              features=intent_features)

intent_labels = intent_dataset['train'].features['label'].names
intent_label2id = {label: i for i, label in enumerate(intent_labels)}
id2intent_label = {i: label for i, label in enumerate(intent_labels)}
num_intent_labels = len(intent_labels)
print("Intent Labels Mapping:", intent_label2id)
print("Number of Intent Labels:", num_intent_labels)

# --- 2. Load and Prepare NER Data ---
print("\n--- Loading and Preparing NER Data ---")
try:
    ner_dataset = load_dataset('json', data_files={'train': NER_DATA_TRAIN, 'test': NER_DATA_TEST})
except FileNotFoundError:
    print(f"Error: NER training file '{NER_DATA_TRAIN}' or test file '{NER_DATA_TEST}' not found.")
    exit()
except Exception as e:
    print(f"Error loading NER data: {e}")
    exit()

# Create NER label mappings
ner_tags_list = list(set([tag for example in ner_dataset['train'] for tag in example['ner_tags']]))
ner_tags_list.sort() # Important for consistency
ner_label2id = {label: i for i, label in enumerate(ner_tags_list)}
id2ner_label = {i: label for i, label in enumerate(ner_tags_list)}
num_ner_labels = len(ner_tags_list)
print("NER Labels Mapping:", ner_label2id)
print("Number of NER Labels:", num_ner_labels)


# --- 3. Initialize Tokenizers and Models ---
print("\n--- Initializing Tokenizers and Base Models ---")
intent_tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_CHECKPOINT)
intent_model = AutoModelForSequenceClassification.from_pretrained(
    BASE_MODEL_CHECKPOINT,
    num_labels=num_intent_labels,
    id2label=id2intent_label,
    label2id=intent_label2id
)

ner_tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_CHECKPOINT)
ner_model = AutoModelForTokenClassification.from_pretrained(
    BASE_MODEL_CHECKPOINT,
    num_labels=num_ner_labels,
    id2label=id2ner_label,
    label2id=ner_label2id
)

# --- 4. Define Tokenization Functions ---
print("--- Defining Tokenization Functions ---")
def tokenize_intents(batch):
    tokenized_inputs = intent_tokenizer(
        batch['text'],
        truncation=True,
        padding='max_length',
        max_length=MAX_LENGTH
    )
    tokenized_inputs["labels"] = batch['label']
    return tokenized_inputs

def tokenize_and_align_labels_ner(examples):
    tokenized_inputs = ner_tokenizer(
        examples["tokens"],
        truncation=True,
        is_split_into_words=True,
        padding='max_length',
        max_length=MAX_LENGTH
    )
    labels = []
    for i, label in enumerate(examples[f"ner_tags"]):
        word_ids = tokenized_inputs.word_ids(batch_index=i)
        previous_word_idx = None
        label_ids = []
        for word_idx in word_ids:
            if word_idx is None:
                label_ids.append(-100)
            elif word_idx != previous_word_idx:
                try:
                    label_ids.append(ner_label2id[label[word_idx]])
                except IndexError:
                     # Handle cases where label list might be shorter than expected (data issue)
                     print(f"Warning: IndexError aligning NER labels. Word index {word_idx}, Label list length {len(label)}. Assigning -100.")
                     label_ids.append(-100) # Or handle as appropriate
            else:
                label_ids.append(-100) # Ignore subsequent subword tokens
            previous_word_idx = word_idx
        labels.append(label_ids)
    tokenized_inputs["labels"] = labels
    return tokenized_inputs

# --- 5. Apply Tokenization ---
print("--- Applying Tokenization ---")
encoded_intent_dataset = intent_dataset.map(tokenize_intents, batched=True)
encoded_ner_dataset = ner_dataset.map(tokenize_and_align_labels_ner, batched=True)
print("Tokenization complete.")

# --- 6. Define Compute Metrics Functions ---
print("--- Defining Metrics Functions ---")
def compute_metrics_intent(pred):
    labels = pred.label_ids
    preds = np.argmax(pred.predictions, axis=1)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='weighted', zero_division=0)
    acc = accuracy_score(labels, preds)
    return {'accuracy': acc, 'f1': f1, 'precision': precision, 'recall': recall}

def compute_metrics_ner(p):
    predictions, labels = p
    predictions = np.argmax(predictions, axis=2)
    true_predictions = [
        [id2ner_label[p] for (p, l) in zip(prediction, label) if l != -100]
        for prediction, label in zip(predictions, labels)
    ]
    true_labels = [
        [id2ner_label[l] for (p, l) in zip(prediction, label) if l != -100]
        for prediction, label in zip(predictions, labels)
    ]
    f1 = f1_score(true_labels, true_predictions, average="weighted")
    report = classification_report(true_labels, true_predictions, output_dict=True, zero_division=0)
    return {
        "precision": report["weighted avg"]["precision"],
        "recall": report["weighted avg"]["recall"],
        "f1": f1,
    }

# --- 7. Define Training Arguments ---
print("--- Defining Training Arguments ---")
intent_training_args = TrainingArguments(
    output_dir=INTENT_OUTPUT_DIR,
    num_train_epochs=INTENT_EPOCHS,
    per_device_train_batch_size=INTENT_BATCH_SIZE,
    per_device_eval_batch_size=INTENT_BATCH_SIZE,
    warmup_steps=500,
    weight_decay=0.01,
    logging_dir='./logs/intent_classifier',
    logging_steps=10,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    save_total_limit=2, # Limit number of checkpoints saved
    push_to_hub=False,
)

ner_training_args = TrainingArguments(
    output_dir=NER_OUTPUT_DIR,
    num_train_epochs=NER_EPOCHS,
    per_device_train_batch_size=NER_BATCH_SIZE,
    per_device_eval_batch_size=NER_BATCH_SIZE,
    warmup_steps=500,
    weight_decay=0.01,
    logging_dir='./logs/ner_model',
    logging_steps=10,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1",
    save_total_limit=2, # Limit number of checkpoints saved
    push_to_hub=False,
)

# --- 8. Initialize Trainers ---
print("--- Initializing Trainers ---")
intent_trainer = Trainer(
    model=intent_model,
    args=intent_training_args,
    train_dataset=encoded_intent_dataset["train"],
    eval_dataset=encoded_intent_dataset["test"], # Ideally use a separate validation set
    tokenizer=intent_tokenizer,
    compute_metrics=compute_metrics_intent,
)

ner_data_collator = DataCollatorForTokenClassification(tokenizer=ner_tokenizer)
ner_trainer = Trainer(
    model=ner_model,
    args=ner_training_args,
    train_dataset=encoded_ner_dataset["train"],
    eval_dataset=encoded_ner_dataset["test"], # Ideally use a separate validation set
    tokenizer=ner_tokenizer,
    data_collator=ner_data_collator,
    compute_metrics=compute_metrics_ner,
)

# --- 9. Train Models ---
if __name__ == "__main__": # Ensure training runs only when script is executed directly
    print("\n--- Starting Intent Model Training ---")
    intent_trainer.train()
    print("Intent training finished.")

    print("\n--- Starting NER Model Training ---")
    ner_trainer.train()
    print("NER training finished.")

    # --- 10. Save Final Models and Tokenizers ---
    print("\n--- Saving Final Models and Tokenizers ---")
    intent_trainer.save_model(FINAL_INTENT_MODEL_DIR)
    intent_tokenizer.save_pretrained(FINAL_INTENT_MODEL_DIR)
    print(f"Intent model and tokenizer saved to {FINAL_INTENT_MODEL_DIR}")

    ner_trainer.save_model(FINAL_NER_MODEL_DIR)
    ner_tokenizer.save_pretrained(FINAL_NER_MODEL_DIR)
    print(f"NER model and tokenizer saved to {FINAL_NER_MODEL_DIR}")

    # --- 11. Evaluate Final Models on Test Set ---
    print("\n--- Evaluating Final Intent Model on Test Set ---")
    intent_eval_results = intent_trainer.evaluate(encoded_intent_dataset['test'])
    print(intent_eval_results)

    print("\n--- Evaluating Final NER Model on Test Set ---")
    ner_eval_results = ner_trainer.evaluate(encoded_ner_dataset['test'])
    print(ner_eval_results)

    print("\n--- Training and Evaluation Complete ---")