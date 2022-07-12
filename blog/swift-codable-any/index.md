---
title: Encoding and decoding json into Any
date: "2022-07-12T10:00:00.000Z"
description: How to decode dynamic, nested json into Any
---

Swift has some nice facilities for working with json. In the truly general case, you can throw in some json, get back a generic dictionary of `[String: Any]`, and cast as needed. You can also decode into concrete types you know the shape of. Unfortunately, mixing these approaches can be tricky. The minute you want to decode a piece of dynamic data into `Any`, the compiler starts yelling at you, and before you know it you have 5 Stack Overflow tabs open, somehow less close than you were before.

This post will cut through the noise and show you how to truly encode and decode `Any`.

This work is adapted from [this gist](https://gist.github.com/mikebuss/17142624da4baf9cdcc337861e256533). I had searched pretty extensively for how to do this, and this had the pieces I was missing, from which I was able to work out the rest.

We'll start with decoding, walking through everything step by step, from the ground up. Encoding is a straightforward inversion of decoding, so we'll close by quickly going over the encoding solution, along with a full demo showing everything.  

## Getting started: generic decoding

Swift's `JSONSerialization.jsonObject` method allows you to turn a JSON string into a matching `[String: Any]` dictionary. 

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

this prints roughly what you'd expect

> ["arr": [1, 2, 3], "obj": ["nestedString": "str", "nestedInt": 12], "b": "Hello", "a": 12] 
> 
> 1

Here's a [live demo](https://replit.com/@arackaf/basicjsondecoding#main.swift)

## Decoding concrete types

Obviously casting around all those `Any` values isn't ideal. But if you know the shape of your data, and can represent it as a concrete type, then you can decode into something more structured.

If we have a Movie type, like this

```swift
struct Movie: Codable {
  var title: String
  var year: Int
}
```

then we can easily decode into it with a JSONDecoder, like this 

```swift
let json = """
  { "title": "Jackass: The Movie", "year": 2002 }
""".data(using: .utf8)!

let jsonDecoder = JSONDecoder();

if let movie = try? jsonDecoder.decode(Movie.self, from: json) {    
  print(movie.title, movie.year)
}
```

which works just fine 

> Jackass: The Movie 2002

Here's [a live demo](https://replit.com/@arackaf/decodingjsonconcretetypes#main.swift).

## Best of both worlds

Let's say movies can have arbitrary metadata. Should be easy, right? We'll add a field, and that'll be that. 

```swift
struct Movie: Codable {
  var title: String
  var year: Int
  var metadata: Any?
}
```

We expect a metadata field that we can just cast as needed, like we did with the `[String: Any]` result from `JSONSerialization.jsonObject` we saw above. Unfortunately, the compiler has other ideas. This change alone causes a number of errors, but the one I'll point out is this

> main.swift:6:7: note: cannot automatically synthesize 'Decodable' because 'Any' does not conform to 'Decodable'
>  var metadata: Any
>      ^

The Codable protocol has a few methods it requires, but Swift is able to write them (synthesize them) for you if, and only if all of the struct's properties are themselves Codable. Strings and Ints are; `Any` is not.

This is where that frustrating Googling usually starts. The solution is actually somewhat straightforward, but it's not well documented in any single place I could find. This post aims to be that place.

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

We moved our dynamic value to its own struct, and put that dynamic value in a field. This doesn't affect our solution, and while it may seem inconvenient to now have to go through a `value` field to get our metadata, the upside is this will make our solution more reusable. Once we make `JSON` codable, all of Movie's fields will be Codable, and Swift will be able to synthesize everything it needs for `Movie`: best of all, we'll be able to reuse this `JSON` struct anywhere we'd like.

### Getting started 

Let's see what we need to add to `JSON` to make it Codable.

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

> { "title": "Jackass: The Movie", "year": 2002, "metadata": "Comedy" }

now decodes into 

> Movie(title: "Jackass: The Movie", year: 2002, metadata: main.JSON(value: Optional(0)))

So how do we get appropriate values into JSON's `value` field?

#### Decoding single values

Let's assume, for now, that our metadata field will always be a single value, which for json means a string, boolean, number or null. `Decoder` has a `singleValueContainer` method which returns a `SingleValueDecodingContainer` instance. *That* type has decode methods which handle every scalar type there is: String, Int, Double, Float, Bool, etc., as well as a `decodeNil` method to check for `nil`.

Let's put those pieces together

```swift
struct JSON: Codable {
  var value: Any?

  public init(from decoder: Decoder) throws {
    if let value = try? decoder.singleValueContainer() {
      if value.decodeNil() {
        self.value = nil
      } else {
        if let result = try? value.decode(Int.self) { self.value = result }
        if let result = try? value.decode(Double.self) { self.value = result }
        if let result = try? value.decode(String.self) { self.value = result }
        if let result = try? value.decode(Bool.self) { self.value = result }
      }
    }
  }

  public func encode(to encoder: Encoder) throws {
  }
}
```

Our init method grabs a `singleValueContainer`, checks for nil, or decodes the real value.

The metadata above now decodes into 

> Movie(title: "Jackass: The Movie", year: 2002, metadata: main.JSON(value: Optional("Comedy")))

#### Decoding nested objects

We already have 

> { "title": "Jackass: The Movie", "year": 2002, "metadata": "Comedy" }

working, but that's not very realistic, or useful. What we really want is for this to work

> { "title": "Jackass: The Movie", "year": 2002, "metadata": { "genre": "Comedy" } }

We want metadata here to be turned into a dictionary, with a single entry for "genre" (and any other entries it might have). You might be hoping you can do

```swift
container.decode([String: Any].self)
```

but alas, no, you cannot. But what you *can* do is 

```swift
container.nestedContainer(keyedBy:)
```

The `keyedBy` was sticking point for me, initially. Most decoding examples you see create an enum, listing all possible keys in the container, for example

```swift
enum CodingKeys: String, CodingKey {
  case title
  case year    
  case metadata
}
```

But you need a *dynamic* set of keys. The solution is simple:

```swift
struct JSONCodingKeys: CodingKey {
  var stringValue: String
    
  init(stringValue: String) {
    self.stringValue = stringValue
  }
    
  var intValue: Int?
    
  init?(intValue: Int) {
    self.init(stringValue: "\(intValue)")
    self.intValue = intValue
  }
}
```

With that, we can now say

```swift
if let container = try? decoder.container(keyedBy: JSONCodingKeys.self)
```

If that succeeds, container will be an instance of `KeyedDecodingContainer<JSONCodingKeys>`. This type has an `allKeys` property, for all keys this container happens to have, as well as `container.decode(Int.self, forKey:)` methods, just like before.

Let's see what our init method looks like now

```swift
public init(from decoder: Decoder) throws {
  if let container = try? decoder.container(keyedBy: JSONCodingKeys.self) {
    self.value = decode(fromObject: container)
  } else if let value = try? decoder.singleValueContainer() {
    if value.decodeNil() {
      self.value = nil
    } else {
      if let result = try? value.decode(Int.self) { self.value = result }
      if let result = try? value.decode(Double.self) { self.value = result }
      if let result = try? value.decode(String.self) { self.value = result }
      if let result = try? value.decode(Bool.self) { self.value = result }
    }
  }
}
```

Notice how we check for the container *first*. A container will happily decode into the singleValueContainer method, but we don't want that; we want to pick up the `decoder.container` method instead, if it's a match, which is why we test for that first.

From there we pass our container to a new `decode(fromObject:)` method: let's have a look at that

```swift
func decode(fromObject container: KeyedDecodingContainer<JSONCodingKeys>) -> [String: Any] {
  var result: [String: Any] = [:]

  for key in container.allKeys {
    if let val = try? container.decode(Int.self, forKey: key) { result[key.stringValue] = val }
    else if let val = try? container.decode(Double.self, forKey: key) { result[key.stringValue] = val }
    else if let val = try? container.decode(String.self, forKey: key) { result[key.stringValue] = val }
    else if let val = try? container.decode(Bool.self, forKey: key) { result[key.stringValue] = val }
    else if let nestedContainer = try? container.nestedContainer(keyedBy: JSONCodingKeys.self, forKey: key) {
      result[key.stringValue] = decode(fromObject: nestedContainer)
    } else if (try? container.decodeNil(forKey: key)) == true  {
      result.updateValue(Optional<Any>(nil) as Any, forKey: key.stringValue)
    }
  }
    
  return result
}
```

Reasonably straightforward. We loop each key, and then try to decode for each possible json type. Note in particular the line with 

```swift
else if let nestedContainer = try? container.nestedContainer(keyedBy: JSONCodingKeys.self, forKey: key)
```

That will seamlessly handle nested objects!

And of course we have 

```swift
else if (try? container.decodeNil(forKey: key)) == true  {
  result.updateValue(Optional<Any>(nil) as Any, forKey: key.stringValue)
}
```

which will test for null on any given key, along with a few pokes and prods for the Swift compiler to properly insert a nil value into a dictionary that's typed as `[String: Any]`.

#### What about arrays?

There's one last missing piece: arrays. We've seen the `decoder.container(keyedBy:)` method to attempt to get an object from our json string. There's also a `decoder.unkeyedContainer()` to get an array from our json. Here's the final version of our init

```swift
public init(from decoder: Decoder) throws {
  if let container = try? decoder.container(keyedBy: JSONCodingKeys.self) {
    self.value = decode(fromObject: container)
  } else if var array = try? decoder.unkeyedContainer() {
    self.value = decode(fromArray: &array)
  } else if let value = try? decoder.singleValueContainer() {
    if value.decodeNil() {
      self.value = nil
    } else {
      if let result = try? value.decode(Int.self) { self.value = result }
      if let result = try? value.decode(Double.self) { self.value = result }
      if let result = try? value.decode(String.self) { self.value = result }
      if let result = try? value.decode(Bool.self) { self.value = result }
    }
  }
}
```

The `unkeyedContainer` method returns an instance of `UnkeyedDecodingContainer` if there's an array. This is processed a bit differently. There's an `isAtEnd` property we can test for, while repeatedly trying to decode the next value. Decoding the next value mutates the container, and advances to the next item, so we need to declare with `var` and pass it as `inout`. 

Let's see our decode method for arrays

```swift
func decode(fromArray container: inout UnkeyedDecodingContainer) -> [Any] {
  var result: [Any] = []

  while !container.isAtEnd {
    if let value = try? container.decode(String.self) { result.append(value) }
    else if let value = try? container.decode(Int.self) { result.append(value) }
    else if let value = try? container.decode(Double.self) { result.append(value) }
    else if let value = try? container.decode(Bool.self) { result.append(value) }
    else if let nestedContainer = try? container.nestedContainer(keyedBy: JSONCodingKeys.self) {
      result.append(decode(fromObject: nestedContainer))
    }
    else if var nestedArray = try? container.nestedUnkeyedContainer() {
      result.append(decode(fromArray: &nestedArray))
    } else if (try? container.decodeNil()) == true {
      result.append(Optional<Any>(nil) as Any)
    }
  }
    
  return result
}
```

Very familiar, except this time we're appending to an array, rather than a dictionary. And of course we check each nested item for arrays or objects, and call the same decode methods we've already seen. This will seamlessly handle arrays within objects, arrays within objects within objects, etc.

And of course our prior method, `func decode(fromObject:)` is also updated to handle arrays

```swift
else if var nestedArray = try? container.nestedUnkeyedContainer(forKey: key) {
  result[key.stringValue] = decode(fromArray: &nestedArray)
}
```

#### Wrapping up decoding

That was a lot. If you found it hard to follow the various code snippets, there's a live demo of everything working, at the end.

### Encoding

Encoding is basically a 180 to decoding, both conceptually and in the implementation. To decode, we're given a decoder, and we attempt to pull values out by various types, and when we succeed, we know how to store that value. To encode, we start with our value, typed as `Any`. We inspect the type of our value, and then call the appropriate method on our encoder.

Let's take a look at the `encode` method on our `JSON` type.

```swift
public func encode(to encoder: Encoder) throws {
  if let map = self.value as? [String: Any] {
    var container = encoder.container(keyedBy: JSONCodingKeys.self)
    try encodeValue(fromObjectContainer: &container, map: map)
  } else if let arr = self.value as? [Any] {
    var container = encoder.unkeyedContainer()
    try encodeValue(fromArrayContainer: &container, arr: arr)
  } else {
    var container = encoder.singleValueContainer()
        
    if let value = self.value as? String {
      try container.encode(value)
    } else if let value = self.value as? Int {
      try container.encode(value)
    } else if let value = self.value as? Double {
      try container.encode(value)
    } else if let value = self.value as? Bool {
      try container.encode(value)
    } else {
      try container.encodeNil()
    }
  }
}
```

We check to see if our value is a dictionary, and if so, create an encoding container for dictionaries, and call a method to handle it. And similarly for arrays. Note that for these encoding containers, we pass as inout arguments, since the encoding methods we call on them are mutating. 

If our value is scalar, we figure out the type, and call the relevant method.

Lastly, note that we're using `try` here, rather than `try?`. With decoding, we needed to try the various decoding methods, and see which one succeeded. We did this by using `try?`, and then discarding the nil values of anything that didn't succeed. With encoding, we check the types of *our own* values, and then *know* the correct encoding method to call. At that point, we expect it to succeed, and if it doesn't, something has gone wrong, and we *want* the exception to throw, and be processed by the relevant application code. 

Let's see the encoding method for dictionaries. 

```swift
func encodeValue(fromObjectContainer container: inout KeyedEncodingContainer<JSONCodingKeys>, map: [String:Any]) throws {
  for k in map.keys {
    let value = map[k]
    let encodingKey = JSONCodingKeys(stringValue: k)
        
    if let value = value as? String {
      try container.encode(value, forKey: encodingKey)
    } else if let value = value as? Int {
      try container.encode(value, forKey: encodingKey)
    } else if let value = value as? Double {
      try container.encode(value, forKey: encodingKey)
    } else if let value = value as? Bool {
      try container.encode(value, forKey: encodingKey)
    } else if let value = value as? [String: Any] {
      var keyedContainer = container.nestedContainer(keyedBy: JSONCodingKeys.self, forKey: encodingKey)
      try encodeValue(fromObjectContainer: &keyedContainer, map: value)
    } else if let value = value as? [Any] {
      var unkeyedContainer = container.nestedUnkeyedContainer(forKey: encodingKey)
      try encodeValue(fromArrayContainer: &unkeyedContainer, arr: value)
    } else {
      try container.encodeNil(forKey: encodingKey)
    }
  }
}
```

We loop the keys, and as before, we figure out the right encoding method to call.

The array version is similar 

```swift
func encodeValue(fromArrayContainer container: inout UnkeyedEncodingContainer, arr: [Any]) throws {
  for value in arr {
    if let value = value as? String {
      try container.encode(value)
    } else if let value = value as? Int {
      try container.encode(value)
    } else if let value = value as? Double {
      try container.encode(value)
    } else if let value = value as? Bool {
      try container.encode(value)
    } else if let value = value as? [String: Any] {
      var keyedContainer = container.nestedContainer(keyedBy: JSONCodingKeys.self)
      try encodeValue(fromObjectContainer: &keyedContainer, map: value)
    } else if let value = value as? [Any] {
      var unkeyedContainer = container.nestedUnkeyedContainer()
      try encodeValue(fromArrayContainer: &unkeyedContainer, arr: value)
    } else {
      try container.encodeNil()
    }
  }
}
```

That was a lot! Here's a [full, working demo of the above](to.do).

## Wrapping up

We've come a long way. Swift offers a ton of convenient methods for JSON encoding, and decoding. It offers straightforward methods for working against concrete types, and it'll even let you work against untyped dictionaries of `[String: Any]`.  But mixing those approaches is surprisingly counterintuitive. Any isn't Codable on its own, but as we saw, it's reasonably straightforward, if tedious to make it so. 