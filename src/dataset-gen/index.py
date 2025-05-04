import json
import os
from openai import AzureOpenAI
import time
import re


# Initialize Azure OpenAI client
def initialize_client():
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    if not api_key or not endpoint or not deployment_name:
        print(
            "Please set the AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT_NAME environment variables."
        )
        print("You can do this by running:")
        print("export AZURE_OPENAI_API_KEY=your_api_key")
        print("export AZURE_OPENAI_ENDPOINT=your_endpoint")
        print("export AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name")
        exit(1)

    client = AzureOpenAI(
        api_key=api_key, api_version="2023-05-15", azure_endpoint=endpoint
    )

    return client, deployment_name


# Generate a response using Azure OpenAI
def generate_response(
    client, deployment_name, prompt, system_message="You are a helpful assistant."
):
    try:
        response = client.chat.completions.create(
            model=deployment_name,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating response: {e}")
        return None


# Generate a single sample variation
def generate_single_variation(
    client, deployment_name, sample_input, sample_output, index
):
    prompt = f"""
    Create a new example conversation pair similar to:

    USER: {sample_input}
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

    for attempt in range(3):  # Try up to 3 times to get valid JSON
        response = generate_response(client, deployment_name, prompt, system_message)

        # Extract JSON object (if it exists)
        try:
            # First, try to find a JSON object in the response
            json_match = re.search(r"(\{.*\})", response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                sample = json.loads(json_str)
                if "messages" in sample and len(sample["messages"]) == 2:
                    return sample
        except:
            pass

        # If we're here, we couldn't parse the JSON or it didn't have the right structure
        time.sleep(1)  # Short delay before retrying

    # If all attempts failed, create a simple variation
    return {
        "messages": [
            {"role": "user", "content": f"Variation {index} of: {sample_input}"},
            {"role": "assistant", "content": f"Variation {index} of: {sample_output}"},
        ]
    }


# Generate dataset samples
def generate_dataset_samples(
    client, deployment_name, sample_input, sample_output, num_samples
):
    samples = []

    # Add the original example
    original_sample = {
        "messages": [
            {"role": "user", "content": sample_input},
            {"role": "assistant", "content": sample_output},
        ]
    }
    samples.append(original_sample)

    # Generate variations
    print(f"Generating {num_samples-1} additional samples...")
    for i in range(num_samples - 1):
        print(f"Generating sample {i+2}/{num_samples}...", end="\r")
        sample = generate_single_variation(
            client, deployment_name, sample_input, sample_output, i + 1
        )
        samples.append(sample)

    print("\nAll samples generated successfully!")
    return samples


# Save dataset to JSONL file
def save_to_jsonl(samples, filename="dataset.jsonl"):
    with open(filename, "w") as f:
        for sample in samples:
            f.write(json.dumps(sample) + "\n")
    print(f"Dataset saved to {filename}")


# Main function
def main():
    print("Welcome to the Dataset Generator!")
    print(
        "This tool will help you create a dataset for fine-tuning based on your examples."
    )
    print("=" * 50)

    # Check if the environment variables are set, if not prompt the user
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    if not api_key:
        api_key = input("Enter your Azure OpenAI API key: ")
        os.environ["AZURE_OPENAI_API_KEY"] = api_key

    if not endpoint:
        endpoint = input("Enter your Azure OpenAI endpoint: ")
        os.environ["AZURE_OPENAI_ENDPOINT"] = endpoint

    if not deployment_name:
        deployment_name = input("Enter your Azure OpenAI deployment name: ")
        os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"] = deployment_name

    client, deployment_name = initialize_client()

    while True:
        sample_input = input("\nEnter a sample user message: ")

        print("\nGenerating a sample response...")
        sample_output = generate_response(client, deployment_name, sample_input)
        print(f"\nSample Response:\n{sample_output}")

        is_good = input("\nIs this response good? (yes/no): ").lower()

        while is_good != "yes" and is_good != "y":
            feedback = input(
                "\nPlease provide specific feedback to improve the response: "
            )

            improvement_prompt = f"""
            Original user message: "{sample_input}"
            Previous response: "{sample_output}"
            Feedback: "{feedback}"

            Please provide an improved response based on the feedback.
            """

            print("\nGenerating an improved response...")
            sample_output = generate_response(
                client,
                deployment_name,
                improvement_prompt,
                "You are revising a response based on user feedback.",
            )
            print(f"\nRevised Response:\n{sample_output}")

            is_good = input("\nIs this response good? (yes/no): ").lower()

        num_samples = 0
        while num_samples <= 0:
            try:
                num_samples = int(
                    input("\nHow many total samples would you like to generate? ")
                )
                if num_samples <= 0:
                    print("Please enter a positive number.")
            except ValueError:
                print("Please enter a valid number.")

        print(f"\nGenerating {num_samples} samples (including your example)...")
        samples = generate_dataset_samples(
            client, deployment_name, sample_input, sample_output, num_samples
        )

        filename = (
            input("\nEnter filename for your dataset (default: dataset.jsonl): ")
            or "dataset.jsonl"
        )
        if not filename.endswith(".jsonl"):
            filename += ".jsonl"

        save_to_jsonl(samples, filename)

        print("\nHere's a preview of your dataset:")
        with open(filename, "r") as f:
            preview = [next(f) for _ in range(min(3, num_samples))]
            for line in preview:
                print(line.strip())
                sample = json.loads(line)
                print(f"USER: {sample['messages'][0]['content']}")
                print(f"ASSISTANT: {sample['messages'][1]['content']}")
                print("-" * 50)

        continue_generating = input(
            "\nWould you like to create another dataset? (yes/no): "
        ).lower()
        if continue_generating != "yes" and continue_generating != "y":
            break

    print("\nThank you for using the Dataset Generator!")


if __name__ == "__main__":
    main()
