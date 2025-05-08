import json
import os
from openai import AzureOpenAI
import time
import re
from dotenv import load_dotenv
from pathlib import Path
from typing import Dict, List, Optional, Union, Literal
import random

root_dir = Path(__file__).resolve().parents[2]  # Go up three levels to project root
dotenv_path = root_dir / '.env'
load_dotenv(dotenv_path)

# Type definitions for our payloads and responses
PayloadType = Literal['summarizer', 'add_event', 'update_event', 'cancel_event', 'feedback']
ALL_PAYLOAD_TYPES: List[PayloadType] = ['summarizer', 'add_event', 'update_event', 'cancel_event', 'feedback']

class DatasetGenerator:
    def __init__(self):
        self.client, self.deployment_name = self.initialize_client()
        self.prompt = self.load_prompt()

    def initialize_client(self):
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

        if not api_key or not endpoint or not deployment_name:
            print("error: missing required env vars")
            exit(1)

        client = AzureOpenAI(
            api_key=api_key, api_version="2023-05-15", azure_endpoint=endpoint
        )

        return client, deployment_name

    def load_prompt(self) -> str:
        prompt_dir = os.path.join(root_dir, "src", "dataset-gen", "include", "prompt.txt")
        with open(prompt_dir, "r") as f:
            return f.read()

    def generate_response(
        self, 
        payload_type: PayloadType,
        payload: Dict,
        system_message: str = "You are a dataset generator creating realistic calendar interactions."
    ) -> Optional[Dict]:
        try:
            # Create a prompt that includes the payload type and example
            prompt = f"""
            Generate a realistic interaction for a {payload_type} request.
            
            Input Payload:
            {json.dumps(payload, indent=2)}
            
            Return ONLY a JSON object with this exact structure:
            {{
                "payload": {json.dumps(payload, indent=2)},
                "response": {{
                    // Response should match the expected format for {payload_type}
                }}
            }}
            
            Do not include any explanation or other text, ONLY the JSON object.
            """

            response = self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
            )

            content = response.choices[0].message.content
            json_match = re.search(r"(\{.*\})", content, re.DOTALL)
            
            if json_match:
                return json.loads(json_match.group(1))
            return None

        except Exception as e:
            print(f"Error generating response: {e}")
            return None

    def generate_sample_payload(self, payload_type: PayloadType) -> Dict:
        """Generate a sample payload for the given type"""
        base_event = {
            "summary": "Sample Event",
            "startTime": "2025-05-04T17:00:00+08:00",
            "endTime": "2025-05-04T18:15:00+08:00",
            "location": "Sample Location"
        }

        if payload_type == 'summarizer':
            return {
                "currentCondition": "clear",
                "currentTemperature": 28.25,
                "events": [base_event],
                "currentDate": "2025-05-04T12:00:00+08:00"
            }
        elif payload_type == 'add_event':
            return {
                "events": [base_event],
                "newEvent": {"summary": "New Event"},
                "currentDate": "2025-05-04T12:00:00+08:00"
            }
        elif payload_type == 'update_event':
            return {
                "events": [base_event],
                "eventId": "sample_event_id",
                "updates": {"summary": "Updated Event"},
                "currentDate": "2025-05-04T12:00:00+08:00"
            }
        elif payload_type == 'cancel_event':
            return {
                "events": [base_event],
                "eventId": "sample_event_id",
                "currentDate": "2025-05-04T12:00:00+08:00"
            }
        else:  # feedback
            return {
                "eventId": "sample_event_id",
                "feedback": "Sample feedback",
                "currentDate": "2025-05-04T12:00:00+08:00"
            }

    def generate_dataset(
        self,
        num_samples: int,
        verify_each: bool = False,
        distribution: Optional[Dict[PayloadType, float]] = None
    ) -> List[Dict]:
        samples = []
        
        # If no distribution is provided, create an even distribution
        if distribution is None:
            distribution = {pt: 1.0/len(ALL_PAYLOAD_TYPES) for pt in ALL_PAYLOAD_TYPES}
        
        # Calculate number of samples for each type
        type_counts = {
            pt: max(1, int(num_samples * dist)) 
            for pt, dist in distribution.items()
        }
        
        # Adjust total to match requested number
        total = sum(type_counts.values())
        if total > num_samples:
            excess = total - num_samples
            # Remove excess from the most common type
            most_common = max(type_counts.items(), key=lambda x: x[1])[0]
            type_counts[most_common] -= excess
        
        print(f"\nGenerating {num_samples} samples with the following distribution:")
        for pt, count in type_counts.items():
            print(f"- {pt}: {count} samples")
        
        for payload_type, count in type_counts.items():
            print(f"\nGenerating {count} samples for {payload_type}...")
            
            for i in range(count):
                print(f"Generating sample {i+1}/{count} for {payload_type}...", end="\r")
                
                # Generate sample payload
                payload = self.generate_sample_payload(payload_type)
                
                # Generate response
                interaction = self.generate_response(payload_type, payload)
                
                if not interaction:
                    print(f"\nFailed to generate sample {i+1} for {payload_type}")
                    continue

                if verify_each:
                    print(f"\nSample {i+1} for {payload_type}:")
                    print("Payload:", json.dumps(interaction["payload"], indent=2))
                    print("Response:", json.dumps(interaction["response"], indent=2))
                    
                    is_good = input("\nIs this sample good? (yes/no): ").lower()
                    
                    while is_good not in ["yes", "y"]:
                        feedback = input("\nPlease provide specific feedback to improve the sample: ")
                        
                        improvement_prompt = f"""
                        Original payload: {json.dumps(interaction["payload"])}
                        Previous response: {json.dumps(interaction["response"])}
                        Feedback: {feedback}
                        
                        Please provide an improved response based on the feedback.
                        """
                        
                        print("\nGenerating an improved sample...")
                        improved = self.generate_response(payload_type, payload, improvement_prompt)
                        
                        if improved:
                            interaction = improved
                            print("\nImproved Sample:")
                            print("Payload:", json.dumps(interaction["payload"], indent=2))
                            print("Response:", json.dumps(interaction["response"], indent=2))
                        
                        is_good = input("\nIs this sample good? (yes/no): ").lower()
                
                samples.append(interaction)
            
        print("\nAll samples generated successfully!")
        return samples

    def save_to_jsonl(self, samples: List[Dict], filename: str = "dataset.jsonl"):
        with open(filename, "w") as f:
            for sample in samples:
                f.write(json.dumps(sample) + "\n")
        print(f"Dataset saved to {filename}")

def main():
    generator = DatasetGenerator()
    
    while True:
        print("\nDataset Generator Options:")
        print("1. Generate random mix of all types")
        print("2. Generate specific type")
        print("3. Exit")
        
        choice = input("\nEnter your choice (1-3): ")
        
        if choice == "3":
            break
            
        if choice == "1":
            verify_each = input("\nVerify each sample individually? (yes/no): ").lower() in ["yes", "y"]
            
            num_samples = 0
            while num_samples <= 0:
                try:
                    num_samples = int(input("\nNumber of samples to generate: "))
                except ValueError:
                    print("Please enter a valid number.")
            
            samples = generator.generate_dataset(num_samples, verify_each)
            
        elif choice == "2":
            print("\nSelect payload type:")
            print("1. Summarizer")
            print("2. Add Event")
            print("3. Update Event")
            print("4. Cancel Event")
            print("5. Feedback")
            
            type_choice = input("\nEnter your choice (1-5): ")
            
            payload_types = {
                "1": "summarizer",
                "2": "add_event",
                "3": "update_event",
                "4": "cancel_event",
                "5": "feedback"
            }
            
            if type_choice not in payload_types:
                print("Invalid choice!")
                continue
                
            payload_type = payload_types[type_choice]
            verify_each = input("\nVerify each sample individually? (yes/no): ").lower() in ["yes", "y"]
            
            num_samples = 0
            while num_samples <= 0:
                try:
                    num_samples = int(input("\nNumber of samples to generate: "))
                except ValueError:
                    print("Please enter a valid number.")
            
            # Create distribution for single type
            distribution = {pt: 0.0 for pt in ALL_PAYLOAD_TYPES}
            distribution[payload_type] = 1.0
            
            samples = generator.generate_dataset(num_samples, verify_each, distribution)
        
        else:
            print("Invalid choice!")
            continue
        
        filename = input("\nEnter filename for your dataset (default: dataset.jsonl): ") or "dataset.jsonl"
        if not filename.endswith(".jsonl"):
            filename += ".jsonl"
        
        generator.save_to_jsonl(samples, filename)
        
        continue_generating = input("\nGenerate another dataset? (yes/no): ").lower()
        if continue_generating not in ["yes", "y"]:
            break

if __name__ == "__main__":
    main()
