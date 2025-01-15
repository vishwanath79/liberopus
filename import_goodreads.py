import csv
import requests
from datetime import datetime

def clean_isbn(isbn):
    """Clean ISBN by removing quotes and equals signs"""
    if not isbn:
        return ""
    return isbn.replace('="', '').replace('"', '')

def import_goodreads_books():
    """Import books from Goodreads CSV export"""
    # API endpoint
    api_url = "http://localhost:8000/add-book"
    
    # Read CSV file
    with open('goodreads_library_export.csv', 'r', encoding='utf-8') as file:
        # Read all lines to debug
        content = file.readlines()
        # Get header line and clean it
        header = content[0].strip().split(',')
        # Create CSV reader with cleaned header
        reader = csv.DictReader(content[1:], fieldnames=header)
        
        for row in reader:
            # Skip empty rows
            if not row.get('Title'):
                continue
                
            # Clean and prepare book data
            book_data = {
                "title": row['Title'].strip(),
                "author": row['Author'].strip(),
                "categories": ["Technical"] if row.get('Bookshelves') and "Programming" in row['Bookshelves'] else ["General"],
                "technical_level": "intermediate",  # Default level
                "topics": ["Programming"] if row.get('Bookshelves') and "Programming" in row['Bookshelves'] else ["General"],
                "description": f"A book titled '{row['Title']}' by {row['Author']}",
                "avg_rating": float(row['Average Rating']) if row.get('Average Rating') and row['Average Rating'] else 0.0,
                "page_count": int(row['Number of Pages']) if row.get('Number of Pages') and row['Number of Pages'] else 300,
                "publication_year": int(row['Year Published']) if row.get('Year Published') and row['Year Published'] else datetime.now().year
            }
            
            try:
                # Send POST request to add book
                response = requests.post(api_url, json=book_data)
                if response.status_code == 200:
                    print(f"Successfully added: {book_data['title']}")
                else:
                    print(f"Failed to add {book_data['title']}: {response.text}")
            except Exception as e:
                print(f"Error adding {book_data['title']}: {str(e)}")

if __name__ == "__main__":
    print("Starting Goodreads import...")
    import_goodreads_books()
    print("Import completed!") 