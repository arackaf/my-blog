---
title: Truly decoding json into Any
date: "2022-06-11T10:00:00.000Z"
description: How to decode dynamic, nested json into Any
---

Swift has some nice facilities for decoding json. In the truly general case, you can throw in some JSON, and get back a generic Map of [String: Any], and case as needed. You can also decode into concrete types you know the shape of. Unfortunately, mixing these approaches can be tricky. The minute you want to decode a piece of dynamic data into Any, the compiler starts yelling at you, and before you know it you have 5 Stack Overflow tabs open, and you're somehow less close than you were before.

This post will cut throgh the noise and show you how to truly, honestly decode into Any.

## Getting started: generic decoding

```swift
let json = """
    { "a": 12, "b": "Hello", "arr": [1, 2, 3], "obj": { "nestedInt": 12, "nestedString": "str" } }
""".data(using: .utf8)!

if let jsonObject = try? JSONSerialization.jsonObject(with: json) as? [String: Any] {
    print(jsonObject, "\n")
    
    if let intArray = jsonObject["arr"] as? [Int] {
        print(intArray[0])
    }
}
```

this works, and prints roughly what you'd expect

> ["arr": [1, 2, 3], "obj": ["nestedString": "str", "nestedInt": 12], "b": "Hello", "a": 12] 
> 
> 1

Here's a [live demo](https://replit.com/@arackaf/basicjsondecoding#main.swift)

## Decoding concrete types

Obviously casting around all those Any values isn't ideal. If you know what your data will look like, and can represent it as a concrete type, then you can decode into something more structured.

If we have a Movie type, like this

```swift
struct Movie: Codable {
  var title: String
  var year: Int
}
```

then we can easily decode it with a JSONDecoder, like this 

```swift
let json = """
    { "title": "jackass the movie", "year": 2002 }
""".data(using: .utf8)!

let jsonDecoder = JSONDecoder();

if let movie = try? jsonDecoder.decode(Movie.self, from: json) {    
    print(movie.title, movie.year)
}
```

which works just fine 

> jackass the movie 2002

Here's [a live demo](https://replit.com/@arackaf/decodingjsonconcretetypes#main.swift).

## Best of both worlds

Let's say movies can have arbitrary metadata associated with them. Should be easy, right? We'll add a field, and that'll be that. 

```swift
struct Movie: Codable {
  var title: String
  var year: Int
  var metadata: Any?
}
```

We expect a metadata field that we can just cast as needed. Unfortunately, the compiler has other ideas. This change alone causes a number of errors, but the one I'll point out is this

> main.swift:6:7: note: cannot automatically synthesize 'Decodable' because 'Any' does not conform to 'Decodable'
>  var metadata: Any
>      ^

The Codable protocol has a few methods it requires, but Swift is able to write them for you (synthesize them) if, and only if all of the struct's properties are themselves Codable. Strings and Ints are, but Any is not.

This is where that frustrating Googling ususally starts. The solution is actually somewhat straightforward, but it's not well documented in any single place I could find. This post aims to be that place.

Let's start by making one superficial change that'll make our solution more generalizable 

```swift
struct JSON: Codable {
  var value: Any?
}

struct Movie: Codable {
  var title: String
  var year: Int
  var metadata: JSON
}
```

We moved out dynamic value to its own struct, and put that dynamic value in a field. This doesn't affect our solution, and while it may seem inconvenient to now have to go through a `value` field to get our metadta, the upside is that this will make our solution more generalizable. Once we make `JSON` codable, all of Movie's fields will be Codable, and Swift will be able to synthesize everything it needs for `Movie`: best of all, we'll be able to reuse this JSON struct anywere we'd like.

### Getting started 

Let's see what we need to add to json to make it Codable.

```swift
struct JSON: Codable {
  var value: Any?

  public init(from decoder: Decoder) throws {
    self.value = 0
  }
    
  public func encode(to encoder: Encoder) throws {      
  }  
}
```

This compiles and "works," in so far as the value of our JSON field will always be zero, and we won't ever be able to turn it back into a JSON string (ie the encode method).

> { "title": "jackass the movie", "year": 2002, "metadata": "Immature" }

now decodes into 

> Movie(title: "jackass the movie", year: 2002, metadata: main.JSON(value: Optional(0)))

So how do we get appropriate values into JSON's value field?

#### Decoding single values

Let's assume, for now, that our metadata field will always be a single value, which for json means a string or a number. Decoder has a `singleValueContainer` method which returns a `SingleValueDecodingContainer` instance. *That* type has decode methods which handle every scalar type there is: String, Int, Double, etc.

Let's put those pieces together

```swift
func decode(fromSingleValue container: SingleValueDecodingContainer) -> Any? {
    if let result = try? container.decode(Int.self) { return result }
    if let result = try? container.decode(Double.self) { return result }
    if let result = try? container.decode(String.self) { return result }

    return nil
}

struct JSON: Codable {
  var value: Any?

  public init(from decoder: Decoder) throws {
    if let value = try? decoder.singleValueContainer() {
      self.value = decode(fromSingleValue: value)
    } else {
      self.value = nil
    }
  }

  public func encode(to encoder: Encoder) throws {
  }  
}
```

Which works

The metadata above decodes into 

> Movie(title: "jackass the movie", year: 2002, metadata: main.JSON(value: Optional("Immature")))

#### Decoding nested objects

We alread have 

> { "title": "jackass the movie", "year": 2002, "metadata": "Immature" }

working, but that's not very realistic, or useful. What we really want is for this to work

> { "title": "jackass the movie", "year": 2002, "metadata": { "genre": "Immature" } }

We want metadata here to be turned into a Map, with a single entry for "genre" (with the prior example, with a raw string to continue working)