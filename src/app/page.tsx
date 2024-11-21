"use client"

import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button" 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import { toast } from 'sonner'
import Image from 'next/image'

interface Patron {
  patron_id: number;
  name: string;
  email: string;
  address: string;
  phone: string;
}

interface Book {
  isbn: string;
  title: string;
  year_of_publication: number;
  copies_available: number;
  authors?: string[];
  categories?: string[];
}

interface Loan {
  id: number;
  books: { title: string };
  patrons: { name: string };
  loan_date: string;
  return_date: string | null;
}

interface NewLoan {
  patron_id: string;
  isbn: string;
  loan_date: string;
  return_date: string;
}

export default function Dashboard() {
  const [books, setBooks] = React.useState<Book[]>([])
  const [patrons, setPatrons] = React.useState<Patron[]>([])
  const [loans, setLoans] = React.useState<Loan[]>([])
  const [newBook, setNewBook] = React.useState({ 
    isbn: '', 
    title: '', 
    book_author: '', 
    year: '', 
    copies: '',
    category_id: ''
  })
  const [newPatron, setNewPatron] = React.useState({ name: '', address: '', phone: '', email: '' })
  const [newLoan, setNewLoan] = React.useState<NewLoan>({
    patron_id: '',
    isbn: '',
    loan_date: '',
    return_date: ''
  })
  const [loading, setLoading] = React.useState(true)
  const [loanAction, setLoanAction] = React.useState<'loan' | 'return'>('loan')
  const [authors, setAuthors] = React.useState<Array<{id: number, name: string}>>([])
  const [categories, setCategories] = React.useState<Array<{id: number, name: string}>>([])
  const [selectedBook, setSelectedBook] = React.useState<Book | null>(null)
  const [selectedPatron, setSelectedPatron] = React.useState<Patron | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        await Promise.all([
          fetchBooks(),
          fetchPatrons(),
          fetchLoans()
        ])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  React.useEffect(() => {
    setNewLoan(prev => ({
      ...prev,
      loan_date: new Date().toISOString().split('T')[0]
    }))
  }, [])

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('book')
        .select(`
          isbn,
          title,
          year_of_publication,
          copies_available,
          book_author:book_author(
            author:author_id(name)
          ),
          book_category:book_category(
            category:category_id(name)
          )
        `)
      
      if (error) throw error

      const transformedBooks = data?.map(book => ({
        isbn: book.isbn,
        title: book.title,
        year_of_publication: book.year_of_publication,
        copies_available: book.copies_available,
        authors: Array.isArray(book.book_author) 
          ? book.book_author
              .map((ba: any) => ba.author?.name)
              .filter(Boolean)
          : [],
        categories: Array.isArray(book.book_category) 
          ? book.book_category
              .map((bc: any) => bc.category?.name)
              .filter(Boolean)
          : []
      }))

      setBooks(transformedBooks || [])
    } catch (err: any) {
      console.error('Error fetching books:', err)
      toast.error('Error fetching books')
    }
  }

  const fetchPatrons = async () => {
    try {
      const { data, error } = await supabase
        .from('patron')
        .select('patron_id, name, email, address, phone')
      
      if (error) throw error
      setPatrons(data || [])
    } catch (error) {
      toast.error('Error fetching patrons')
      console.error('Error fetching patrons:', error)
    }
  }

  const fetchLoans = async () => {
    try {
      // First, let's see what's in the loan table
      const { data: rawLoans, error: rawError } = await supabase
        .from('loan')
        .select('*')
      
      console.log('Raw loans without joins:', rawLoans)

      // Now let's try the full query
      const { data, error } = await supabase
        .from('loan')
        .select(`
          loan_id,
          isbn,
          patron_id,
          loan_date,
          return_date,
          books:book(title),
          patrons:patron(name)
        `)
      
      if (error) {
        console.error('Loan fetch error:', error)
        throw error
      }

      console.log('Raw loan data with joins:', data)

      const transformedLoans = data?.map(loan => ({
        id: loan.loan_id,
        // @ts-ignore
        books: { title: loan.books?.title || 'Unknown Book' },
        // @ts-ignore
        patrons: { name: loan.patrons?.name || 'Unknown Patron' },
        loan_date: loan.loan_date,
        return_date: loan.return_date
      }))

      console.log('Transformed loans:', transformedLoans)
      setLoans(transformedLoans || [])
    } catch (error: any) {
      console.error('Error fetching loans:', error)
      toast.error('Error fetching loans')
    }
  }

  const fetchAuthors = async () => {
    const { data, error } = await supabase
      .from('author')
      .select('*')
    if (error) console.error('Author fetch error:', error)
    setAuthors(data || [])
  }

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('category')
      .select('*')
    if (error) console.error('Category fetch error:', error)
    setCategories(data || [])
  }

  const addBook = async () => {
    try {
      console.log('Starting book addition with:', newBook)

      if (!newBook.isbn || !newBook.title || !newBook.book_author || !newBook.category_id) {
        toast.error('Please fill in required fields')
        return
      }

      // 1. First, add the author
      const { data: authorData, error: authorError } = await supabase
        .from('author')
        .insert({ name: newBook.book_author.trim() })
        .select('author_id, name')
        .single()

      if (authorError) {
        console.error('Author insert error:', authorError)
        toast.error('Failed to add author')
        return
      }

      console.log('Added author:', authorData)

      // 2. Then, add the category
      const { data: categoryData, error: categoryError } = await supabase
        .from('category')
        .insert({ name: newBook.category_id.trim() })
        .select('category_id, name')
        .single()

      if (categoryError) {
        console.error('Category insert error:', categoryError)
        toast.error('Failed to add category')
        return
      }

      console.log('Added category:', categoryData)

      // 3. Add the book
      const { error: bookError } = await supabase
        .from('book')
        .insert({
          isbn: newBook.isbn.trim(),
          title: newBook.title.trim(),
          year_of_publication: parseInt(newBook.year) || null,
          copies_available: parseInt(newBook.copies) || 1
        })

      if (bookError) {
        console.error('Book insert error:', bookError)
        toast.error('Failed to add book')
        return
      }

      // 4. Create the book-author relationship
      const { error: authorRelError } = await supabase
        .from('book_author')
        .insert({
          isbn: newBook.isbn.trim(),
          author_id: authorData.author_id
        })

      if (authorRelError) {
        console.error('Author relationship error:', authorRelError)
        toast.error('Failed to link author')
        return
      }

      // 5. Create the book-category relationship
      const { error: categoryRelError } = await supabase
        .from('book_category')
        .insert({
          isbn: newBook.isbn.trim(),
          category_id: categoryData.category_id
        })

      if (categoryRelError) {
        console.error('Category relationship error:', categoryRelError)
        toast.error('Failed to link category')
        return
      }

      console.log('Successfully added all relationships')
      toast.success('Book added successfully')
      await fetchBooks() // Refresh the book list
      setNewBook({ isbn: '', title: '', book_author: '', year: '', copies: '', category_id: '' })
    } catch (err) {
      console.error('Failed to add book:', err)
      toast.error('Failed to add book')
    }
  }

  const addPatron = async () => {
    try {
      if (!newPatron.name || !newPatron.email) {
        toast.error('Please fill in all required fields')
        return
      }

      const { error } = await supabase
        .from('patron')
        .insert([newPatron])
      
      if (error) throw error
      
      toast.success('Patron added successfully')
      fetchPatrons()
      setNewPatron({ name: '', address: '', phone: '', email: '' })
    } catch (error) {
      toast.error('Error adding patron')
      console.error('Error adding patron:', error)
    }
  }

  const addLoan = async () => {
    try {
      if (!newLoan.patron_id || !newLoan.isbn) {
        toast.error('Please fill in all required fields')
        return
      }

      const { error } = await supabase
        .from('loan')
        .insert([{
          patron_id: parseInt(newLoan.patron_id),
          isbn: newLoan.isbn,
          loan_date: new Date().toISOString().split('T')[0],
          return_date: loanAction === 'return' ? new Date().toISOString().split('T')[0] : null
        }])
      
      if (error) throw error

      // Fetch the current number of copies available
      const { data: bookData, error: fetchError } = await supabase
        .from('book')
        .select('copies_available')
        .eq('isbn', newLoan.isbn)
        .single();

      if (fetchError) throw fetchError;

      // Determine the change in copies based on the loan action
      const updateCopies = loanAction === 'loan' ? -1 : 1;

      // Calculate the new number of copies
      const newCopiesAvailable = (bookData?.copies_available || 0) + updateCopies;

      // Update the copies available
      const { error: updateError } = await supabase
        .from('book')
        .update({ copies_available: newCopiesAvailable })
        .eq('isbn', newLoan.isbn);

      if (updateError) throw updateError;

      toast.success(loanAction === 'loan' ? 'Loan created successfully' : 'Book returned successfully')
      await fetchLoans()
      await fetchBooks() // Refresh the books list to reflect updated copies
      setNewLoan({
        patron_id: '',
        isbn: '',
        loan_date: '',
        return_date: ''
      })
    } catch (error) {
      toast.error(`Error ${loanAction === 'loan' ? 'creating loan' : 'returning book'}`)
      console.error('Error:', error)
    }
  }

  const updateBook = async () => {
    if (!selectedBook) return
    try {
      const { error } = await supabase
        .from('book')
        .update({
          title: selectedBook.title,
          copies_available: selectedBook.copies_available,
        })
        .eq('isbn', selectedBook.isbn)

      if (error) throw error
      toast.success('Book updated successfully')
      await fetchBooks()
      setSelectedBook(null)
    } catch (error) {
      console.error('Error updating book:', error)
      toast.error('Failed to update book')
    }
  }

  const updatePatron = async () => {
    if (!selectedPatron) return
    try {
      const { error } = await supabase
        .from('patron')
        .update({
          name: selectedPatron.name,
          email: selectedPatron.email,
          address: selectedPatron.address,
          phone: selectedPatron.phone,
        })
        .eq('patron_id', selectedPatron.patron_id)

      if (error) throw error
      toast.success('Patron updated successfully')
      await fetchPatrons()
      setSelectedPatron(null)
    } catch (error) {
      console.error('Error updating patron:', error)
      toast.error('Failed to update patron')
    }
  }

  const deleteBook = async (isbn: string) => {
    try {
      const { error } = await supabase
        .from('book')
        .delete()
        .eq('isbn', isbn)

      if (error) throw error
      toast.success('Book deleted successfully')
      await fetchBooks()
    } catch (error) {
      console.error('Error deleting book:', error)
      toast.error('Failed to delete book')
    }
  }

  const deletePatron = async (patronId: number) => {
    try {
      const { error } = await supabase
        .from('patron')
        .delete()
        .eq('patron_id', patronId)

      if (error) throw error
      toast.success('Patron deleted successfully')
      await fetchPatrons()
    } catch (error) {
      console.error('Error deleting patron:', error)
      toast.error('Failed to delete patron')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Chronos Library Management System</h1>
        <Image 
          src="/images/chronoslogo.png"
          alt="Library Logo"
          width={200}
          height={50}
          className="object-contain"
        />
      </div>
      <Tabs defaultValue="books">
        <TabsList>
          <TabsTrigger value="books">Books</TabsTrigger>
          <TabsTrigger value="patrons">Patrons</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="update">Update</TabsTrigger>
          <TabsTrigger value="delete">Delete</TabsTrigger>
        </TabsList>
        <TabsContent value="books">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="ISBN *"
                value={newBook.isbn}
                onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
              />
              <Input
                placeholder="Title *"
                value={newBook.title}
                onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
              />
              <Input
                placeholder="Author *"
                value={newBook.book_author}
                onChange={(e) => setNewBook({ ...newBook, book_author: e.target.value })}
              />
              <Input
                placeholder="Category *"
                value={newBook.category_id}
                onChange={(e) => setNewBook({ ...newBook, category_id: e.target.value })}
              />
              <Input
                placeholder="Year of Publication"
                type="number"
                value={newBook.year}
                onChange={(e) => setNewBook({ ...newBook, year: e.target.value })}
              />
              <Input
                placeholder="Copies Available *"
                type="number"
                value={newBook.copies}
                onChange={(e) => setNewBook({ ...newBook, copies: e.target.value })}
              />
            </div>
            <Button onClick={addBook}>Add Book</Button>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISBN</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Author(s)</TableHead>
                  <TableHead>Category(s)</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books.map((book) => (
                  <TableRow key={book.isbn}>
                    <TableCell>{book.isbn}</TableCell>
                    <TableCell>{book.title}</TableCell>
                    <TableCell>{book.authors?.join(', ')}</TableCell>
                    <TableCell>{book.categories?.join(', ')}</TableCell>
                    <TableCell>{book.year_of_publication}</TableCell>
                    <TableCell>{book.copies_available}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="patrons">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Name *"
                value={newPatron.name}
                onChange={(e) => setNewPatron({ ...newPatron, name: e.target.value })}
              />
              <Input
                placeholder="Email *"
                value={newPatron.email}
                onChange={(e) => setNewPatron({ ...newPatron, email: e.target.value })}
              />
              <Input
                placeholder="Address"
                value={newPatron.address}
                onChange={(e) => setNewPatron({ ...newPatron, address: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={newPatron.phone}
                onChange={(e) => setNewPatron({ ...newPatron, phone: e.target.value })}
              />
            </div>
            <Button onClick={addPatron}>Add Patron</Button>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patrons.map((patron) => (
                  <TableRow key={patron.patron_id}>
                    <TableCell>{patron.patron_id}</TableCell>
                    <TableCell>{patron.name}</TableCell>
                    <TableCell>{patron.email}</TableCell>
                    <TableCell>{patron.address}</TableCell>
                    <TableCell>{patron.phone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="loans">
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button 
                variant={loanAction === 'loan' ? 'default' : 'outline'}
                onClick={() => setLoanAction('loan')}
              >
                New Loan
              </Button>
              <Button 
                variant={loanAction === 'return' ? 'default' : 'outline'}
                onClick={() => setLoanAction('return')}
              >
                Return Book
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Patron ID *"
                value={newLoan.patron_id}
                onChange={(e) => setNewLoan({ ...newLoan, patron_id: e.target.value })}
              />
              <Input
                placeholder="ISBN *"
                value={newLoan.isbn}
                onChange={(e) => setNewLoan({ ...newLoan, isbn: e.target.value })}
              />
            </div>
            <Button onClick={addLoan}>
              {loanAction === 'loan' ? 'Create Loan' : 'Return Book'}
            </Button>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Book</TableHead>
                  <TableHead>Patron</TableHead>
                  <TableHead>Loan Date</TableHead>
                  <TableHead>Return Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => {
                  console.log('Rendering loan:', loan)
                  return (
                    <TableRow key={loan.id}>
                      <TableCell>{loan.id}</TableCell>
                      <TableCell>{loan.books?.title || 'Unknown Book'}</TableCell>
                      <TableCell>{loan.patrons?.name || 'Unknown Patron'}</TableCell>
                      <TableCell>{loan.loan_date}</TableCell>
                      <TableCell>{loan.return_date || 'Not returned'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="update">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Update Records</h2>
            
            <div className="border p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Update Book</h3>
              <select 
                className="w-full p-2 border rounded mb-4"
                onChange={(e) => {
                  const book = books.find(b => b.isbn === e.target.value)
                  setSelectedBook(book || null)
                }}
                value={selectedBook?.isbn || ''}
              >
                <option value="">Select a book to update</option>
                {books.map((book) => (
                  <option key={book.isbn} value={book.isbn}>
                    {book.title} (ISBN: {book.isbn})
                  </option>
                ))}
              </select>

              {selectedBook && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Title"
                    value={selectedBook.title}
                    onChange={(e) => setSelectedBook({...selectedBook, title: e.target.value})}
                  />
                  <Input
                    placeholder="Copies Available"
                    type="number"
                    value={selectedBook.copies_available}
                    onChange={(e) => setSelectedBook({...selectedBook, copies_available: parseInt(e.target.value) || 0})}
                  />
                  <Button className="mt-2 col-span-2" onClick={updateBook}>Update Book</Button>
                </div>
              )}
            </div>

            <div className="border p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Update Patron</h3>
              <select 
                className="w-full p-2 border rounded mb-4"
                onChange={(e) => {
                  const patron = patrons.find(p => p.patron_id === parseInt(e.target.value))
                  setSelectedPatron(patron || null)
                }}
                value={selectedPatron?.patron_id || ''}
              >
                <option value="">Select a patron to update</option>
                {patrons.map((patron) => (
                  <option key={patron.patron_id} value={patron.patron_id}>
                    {patron.name} (ID: {patron.patron_id})
                  </option>
                ))}
              </select>

              {selectedPatron && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Name"
                    value={selectedPatron.name}
                    onChange={(e) => setSelectedPatron({...selectedPatron, name: e.target.value})}
                  />
                  <Input
                    placeholder="Email"
                    value={selectedPatron.email}
                    onChange={(e) => setSelectedPatron({...selectedPatron, email: e.target.value})}
                  />
                  <Input
                    placeholder="Address"
                    value={selectedPatron.address}
                    onChange={(e) => setSelectedPatron({...selectedPatron, address: e.target.value})}
                  />
                  <Input
                    placeholder="Phone"
                    value={selectedPatron.phone}
                    onChange={(e) => setSelectedPatron({...selectedPatron, phone: e.target.value})}
                  />
                  <Button className="mt-2 col-span-2" onClick={updatePatron}>Update Patron</Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="delete">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Delete Records</h2>
            
            <div className="border p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Books</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ISBN</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.map((book) => (
                    <TableRow key={book.isbn}>
                      <TableCell>{book.isbn}</TableCell>
                      <TableCell>{book.title}</TableCell>
                      <TableCell>
                        <Button 
                          variant="destructive" 
                          onClick={() => deleteBook(book.isbn)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="border p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Patrons</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patrons.map((patron) => (
                    <TableRow key={patron.patron_id}>
                      <TableCell>{patron.patron_id}</TableCell>
                      <TableCell>{patron.name}</TableCell>
                      <TableCell>
                        <Button 
                          variant="destructive" 
                          onClick={() => deletePatron(patron.patron_id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
