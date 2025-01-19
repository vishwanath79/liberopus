# Insert book into database
cursor.execute("""
    INSERT OR REPLACE INTO books 
    (id, title, author, description, average_rating, topics, publication_year, page_count)
    VALUES (:id, :title, :author, :description, :average_rating, :topics, :publication_year, :page_count)
""", book_data)

books_added += 1
if books_added % 10 == 0:
    print(f"Added {books_added} books...")

# Insert book into database
cursor.execute("""
    INSERT INTO books (
        title, author, description, technical_level, 
        page_count, publication_year
    ) VALUES (?, ?, ?, ?, ?, ?)
    """, (
        book_data.title,
        book_data.author,
        book_data.description,
        book_data.technical_level,
        book_data.page_count,
        book_data.publication_year
    ))

# Get the inserted book
book_id = cursor.lastrowid
cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
book = cursor.fetchone()

return {"message": "Book added successfully", "book": convert_db_book_to_model(book)}

cursor.execute(
    "INSERT INTO dismissed_books (book_id, timestamp) VALUES (?, ?)",
    (request.book_id, datetime.now().isoformat())
)
return {"message": "Book dismissed successfully"}

@app.post("/rate-book")
async def rate_book(request: RatingRequest):
    """Rate a book."""
    try:
        print(f"Processing rating request: {request}")  # Debug log
        with get_db_cursor() as cursor:
            # Check if book exists
            cursor.execute("SELECT id FROM books WHERE id = ?", (request.book_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Book not found")
            
            # Check if rating is valid (1-5)
            if not 1 <= request.rating <= 5:
                raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
            
            # Check if rating already exists
            cursor.execute(
                "SELECT id FROM ratings WHERE book_id = ?",
                (request.book_id,)
            )
            existing_rating = cursor.fetchone()
            
            if existing_rating:
                # Update existing rating
                cursor.execute(
                    "UPDATE ratings SET rating = ? WHERE book_id = ?",
                    (request.rating, request.book_id)
                )
            else:
                # Add new rating
                cursor.execute(
                    "INSERT INTO ratings (book_id, rating) VALUES (?, ?)",
                    (request.book_id, request.rating)
                )
            
            # Calculate and update average rating for the book
            cursor.execute(
                """
                SELECT AVG(rating) as avg_rating
                FROM ratings
                WHERE book_id = ?
                """,
                (request.book_id,)
            )
            avg_rating = cursor.fetchone()["avg_rating"]
            
            cursor.execute(
                "UPDATE books SET average_rating = ? WHERE id = ?",
                (avg_rating or 0, request.book_id)
            )
            
            print(f"Successfully rated book {request.book_id} with rating {request.rating}")  # Debug log
            return {
                "message": "Rating submitted successfully",
                "book_id": request.book_id,
                "rating": request.rating,
                "average_rating": avg_rating or 0
            }
            
    except Exception as e:
        print(f"Error rating book: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# First, ensure all books have IDs
cursor.execute("""
    UPDATE books 
    SET id = LOWER(HEX(RANDOMBLOB(8)))
    WHERE id IS NULL OR id = ''
""")

if rated_books:
    for book_dict in rated_books:
        cursor.execute(
            "UPDATE books SET id = ? WHERE title = ? AND author = ?",
            (book_id, book_dict['title'], book_dict['author'])
        )
        book_dict['id'] = book_id

for item in orders:
    cursor.execute(
        "UPDATE wishlist SET display_order = ? WHERE book_id = ?",
        (item["order"], item["book_id"])
    )
return {"message": "Wishlist reordered successfully"}

@app.post("/get-recommendations")
async def get_recommendations(request: RecommendationRequest):
    """Get personalized book recommendations."""
    try:
        print("Processing recommendation request:", request)
        
        with get_db_cursor() as cursor:
            rated_books = list(request.user_ratings.keys())
            
            # First, ensure all books have IDs
            cursor.execute("""
                UPDATE books 
                SET id = LOWER(HEX(RANDOMBLOB(8)))
                WHERE id IS NULL OR id = ''
            """)
            
            if rated_books:
                placeholders = ','.join(['?' for _ in rated_books])
                query = f"""
                    SELECT 
                        b.id,
                        b.title,
                        b.author,
                        b.description,
                        b.topics,
                        b.publication_year,
                        b.page_count,
                        COALESCE(AVG(r.rating), 0) as average_rating
                    FROM books b
                    LEFT JOIN ratings r ON b.id = r.book_id
                    WHERE b.id NOT IN ({placeholders})
                    GROUP BY b.id
                    HAVING average_rating >= 0
                    ORDER BY average_rating DESC
                    LIMIT 5
                """
                print(f"Executing query with rated_books: {rated_books}")  # Debug log
                cursor.execute(query, rated_books)
            else:
                cursor.execute("""
                    SELECT 
                        b.id,
                        b.title,
                        b.author,
                        b.description,
                        b.topics,
                        b.publication_year,
                        b.page_count,
                        COALESCE(AVG(r.rating), 0) as average_rating
                    FROM books b
                    LEFT JOIN ratings r ON b.id = r.book_id
                    GROUP BY b.id
                    ORDER BY RANDOM()
                    LIMIT 5
                """)

            books = cursor.fetchall()
            print(f"Found {len(books)} recommendations")  # Debug log

            recommendations = []
            for book in books:
                book_dict = dict(book)
                
                # Ensure book has an ID
                if not book_dict.get('id'):
                    book_id = generate_book_id(book_dict['title'], book_dict['author'])
                    cursor.execute(
                        "UPDATE books SET id = ? WHERE title = ? AND author = ?",
                        (book_id, book_dict['title'], book_dict['author'])
                    )
                    book_dict['id'] = book_id

                # Parse topics from JSON string if needed
                if isinstance(book_dict.get('topics'), str):
                    try:
                        book_dict['topics'] = json.loads(book_dict['topics'])
                    except json.JSONDecodeError:
                        book_dict['topics'] = []
                elif book_dict.get('topics') is None:
                    book_dict['topics'] = []

                recommendations.append({
                    'id': book_dict['id'],
                    'title': book_dict['title'],
                    'author': book_dict['author'],
                    'description': book_dict.get('description', ''),
                    'topics': book_dict['topics'],
                    'publication_year': book_dict.get('publication_year'),
                    'page_count': book_dict.get('page_count'),
                    'average_rating': float(book_dict['average_rating']) if book_dict.get('average_rating') else 0
                })
                print(f"Processed recommendation: {recommendations[-1]}")  # Debug log

            return {"recommendations": recommendations}
            
    except Exception as e:
        print(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 