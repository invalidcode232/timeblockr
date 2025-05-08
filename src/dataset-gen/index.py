import json
import os
from openai import AzureOpenAI
import time
import re
from dotenv import load_dotenv
from pathlib import Path

root_dir = Path(__file__).resolve().parents[2]  # Go up three levels to project root
dotenv_path = root_dir / '.env'
load_dotenv(dotenv_path)

def initialize_client():
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

def generate_response(
    client, deployment_name, user_prompt, system_message="You are a helpful assistant."
):
    try:
        response = client.chat.completions.create(
            model=deployment_name,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating response: {e}")
        return None


def generate_single_variation(
    client, deployment_name, user_prompt, sample_output, index
):
    user_prompt = f"""
    Create a new example conversation pair similar to:

    USER: {user_prompt}
    ASSISTANT: {sample_output}

    Your new example should maintain the same tone, style, and type of information but with different content.
    Return ONLY a JSON object with this exact structure:
    {{
        "messages": [
            {{"role": "user", "content": "your new user message here"}},
            {{"role": "assistant", "content": "your new assistant response here"}}
        ]
    }}

    Do not include any explanation or other text, ONLY the JSON object.
    """

    system_message = (
        "You are a dataset generator creating a diverse conversation example."
    )

    for attempt in range(3):  # ERROR CHECKING: Make sure it is valid json, try up to 3 times to get valid JSON
        response = generate_response(client, deployment_name, user_prompt, system_message)

        try:
            json_match = re.search(r"(\{.*\})", response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                sample = json.loads(json_str)
                if "messages" in sample and len(sample["messages"]) == 2:
                    return sample
        except:
            pass

        time.sleep(1)  # Short delay before retrying

    # If all attempts failed, create a simple variation
    return {
        "messages": [
            {"role": "user", "content": f"Variation {index} of: {user_prompt}"},
            {"role": "assistant", "content": f"Variation {index} of: {sample_output}"},
        ]
    }


def generate_dataset_samples(
    client, deployment_name, user_prompt, sample_output, num_samples
):
    samples = []

    original_sample = {
        "messages": [
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": sample_output},
        ]
    }
    samples.append(original_sample)

    print(f"Generating {num_samples-1} additional samples...")
    for i in range(num_samples - 1):
        print(f"Generating sample {i+2}/{num_samples}...", end="\r")
        sample = generate_single_variation(
            client, deployment_name, user_prompt, sample_output, i + 1
        )
        samples.append(sample)

    print("\nAll samples generated successfully!")
    return samples


def save_to_jsonl(samples, filename="dataset.jsonl"):
    with open(filename, "w") as f:
        for sample in samples:
            f.write(json.dumps(sample) + "\n")
    print(f"Dataset saved to {filename}")


# Main function
def main():
    # Read include/prompt.txt, in src/dataset-gen/include
    prompt_dir = os.path.join( root_dir, "src", "dataset-gen", "include", "prompt.txt")
    prompt_file = open(prompt_dir, "r")
    user_prompt = prompt_file.read()
    prompt_file.close()

    print("Prompt loaded from include/prompt.txt:")
    print(user_prompt)

    # Check if the environment variables are set, if not prompt the user
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    if not api_key or not endpoint or not deployment_name:
        print("error: missing required env vars")

    client, deployment_name = initialize_client()

    while True:
        print("\nGenerating a sample response based on prompt...")
        output = generate_response(client, deployment_name, user_prompt)
        print(f"\nSample Response:\n{output}")

        is_good = input("\nIs this response good? (yes/no): ").lower()

        while is_good != "yes" and is_good != "y":
            feedback = input(
                "\nPlease provide specific feedback to improve the response: "
            )

            improvement_prompt = f"""
            Original user message: "{user_prompt}"
            Previous response: "{output}"
            Feedback: "{feedback}"

            Please provide an improved response based on the feedback.
            """

            print("\nGenerating an improved response...")
            output = generate_response(
                client,
                deployment_name,
                improvement_prompt,
                "You are revising a response based on user feedback.",
            )
            print(f"\nRevised Response:\n{output}")

            is_good = input("\nIs this response good? (yes/no): ").lower()

        num_samples = 0
        while num_samples <= 0:
            try:
                num_samples = int(
                    input("\nSample size: ")
                )
            except ValueError:
                print("Please enter a valid number.")

        print(f"\nGenerating {num_samples} samples (including your example)...")
        samples = generate_dataset_samples(
            client, deployment_name, user_prompt, output, num_samples
        )

        filename = (
            input("\nEnter filename for your dataset (default: dataset.jsonl): ")
            or "dataset.jsonl"
        )
        if not filename.endswith(".jsonl"):
            filename += ".jsonl"

        save_to_jsonl(samples, filename)

        continue_generating = input(
            "\nCreate another dataset? (yes/no): "
        ).lower()

        if continue_generating != "yes" and continue_generating != "y":
            break


if __name__ == "__main__":
    main()