---
title: Java Optionals
date: "2024-08-25T20:00:32.169Z"
description: An introduction to Java Optionals
---

There's an old saying in computer science that null was the "billion dollar mistake." It's actually a quote from [Tony Hoare](https://en.wikipedia.org/wiki/Tony_Hoare), the creator of the null reference.

It's easy to understand the hate for null. We've all run into null reference exceptions in just about any language we've used. But as annoying as null reference exceptions can be, it's easy to wonder how they can be avoided. After all, it's inevitable that you might have a variable that's pending assignment. If not null, how would an absence of a value be represented in a way that would prevent a developer creating exceptions after attempting to interact with that non-value.

## Optionals

This post is about the Optional type, which is common way programming languages protect devs from null references. The idea is, the optional type gives you essentially a box, that can be empty (null), or have a value in it. Along with some api's to safely deal with these possibilities.

This is a concept that exists in many languages. Swift has a particularly elegant implementation, which is integrated into various language-level features. But for this post, we'll look at Java, which added an Optional type in version 8 of the language, and along the way we'll run into a few other modern Java features.

## The old way

Let's say we have a basic `Person` type

```java
record Person(String name, int age){}
```

Records were added to Java 14, and are essentially simplified classes for objects which are mainly just carriers of data.

Ok, let's say we want to declare a variable of type `Person`. Normally we'd write

```java
Person p;
```

and then just carefully check for null before referencing any properties

```java
if (p != null) {
  System.out.println(p.name);
}
```

If you failed to check, you'd be greeted with something like

```
Exception in thread "main" java.lang.NullPointerException: Cannot read field "name" because "p" is null
	at Main.main(Main.java:13)
```

## Your first Optional

To use the Optional type, make sure you

```java
import java.util.Optional;
```

and then declare your variable

```java
Optional<Person> personMaybe;
```

If you don't have a value to assign, you can indicate that by assigning `Optional.empty()`

```java
personMaybe = Optional.empty();
```

or you can assign an actual value with the `of` static method

```java
personMaybe = Optional.of(new Person("Mike", 30));
```

If you try to get cute, and assign null this way

```java
personMaybe = Optional.of(null);
```

you'll be greeted by an error immediately

```
Exception in thread "main" java.lang.NullPointerException
	at java.base/java.util.Objects.requireNonNull(Objects.java:209)
	at java.base/java.util.Optional.of(Optional.java:113)
	at Main.main(Main.java:12)
```

But if you truly have a value that might be null, which you want to safely and correctly assign to an optional, you can use the ofNullable method

```java
// where x is of type Person that could be null
personMaybe = Optional.ofNullable(x);
```

## Using your optional

It's one thing to have an optional type that can hold a value, but how do you _use the_ value? The crudest, most dangerous way to access the value contained in your optional is with the `get` method

```java
System.out.println(personMaybe.get().name);
```

`get()` returns the value that's in the optional if there is one, or if the optional is empty, will promptly error out

```
Exception in thread "main" java.util.NoSuchElementException: No value present
	at java.base/java.util.Optional.get(Optional.java:143)
	at Main.main(Main.java:21)
```

There's an `isPresent()` you can call, to check for this

```java
if (personMaybe.isPresent()) {
  System.out.println(personMaybe.get().name);
}
```

But really we're no better off than we were before. These api's allow your to (carefully) interact with api's you might have that are not coded against Optional types. But in general using `get` should be avoided where possible.

Let's see some of the better api's Optional ships with.

## Using Optionals effectively

If we want to use an optional, rather than carefully calling `get` (after verifying there's a value) we can use the `isPresent()` method

```java
personMaybe.ifPresent(p -> System.out.println(p.name));
```

We pass in a lambda expression that will be invoked with the person value. If the optional is empty, nothing will be done. If you'd like to also handle the empty use case, we can use `ifPresentOrElse`.

```java
personMaybe.ifPresentOrElse(p -> System.out.println(p.name), () -> System.out.println("No person"));
```

It's the same as before, except no we provide a lambda for when the optional is empty.

## Getting values from an Optional

Let's say we want to get a value from an Optional. Let's first expand our `Person` type just a bit.

```java
record Person(String name, int age, Optional<Person> bestFriend){}
```

Now let's say we have a `Person` optional like so

```java
personMaybe = Optional.of(new Person("Mike", 30, Optional.empty()));
```

and let's say we want to get that person's name (and we don't want to assume there's a value in there). We want to store this as an `Optional<String>`. Obviously we could do something ridiculous like this

```java
Optional<String> personsName = personMaybe.isPresent() ? Optional.of(personMaybe.get().name) : Optional.empty();
```

but it should come as no surprise that there's a more direct api, map. `map` takes a lambda expression, from which you return whatever you want from the object. The type system will look at what you return, and fit that into an Optional of that type. If there's no value present in the Optional, the lambda will not be called, and you'll be safely left with `Optional.empty()`

```java
Optional<String> personsName = personMaybe.map(p -> p.name);
```

And since records automatically create getter methods for all properties, the following would also work

```java
Optional<String> personsName = personMaybe.map(Person::name);
```

And of course Java supports inferred typings now, so you could simply write

```java
var personsName = personMaybe.map(Person::name);
```

`var` here does _not_ mean what it means in JavaScript, where the value is dynamically typed. Rather, it means what it does in C#, which is merely a shortcut where, instead of typing out the type, you can simply tell the type system to infer the correct type based on what's on the right hand side of the assignment, and just pretend you typed that. Needless to say

```java
var x;
```

produces a compiler error of

```
java: cannot infer type for local variable x
  (cannot use 'var' on variable without initializer)
```

## Optionals of optionals

Ok we added the `bestFriend` property of our Person record, which is of type `Optional<Person>`. Let's put it to good use.

```java
Optional<Person> personsBestFriend = personMaybe.map(p -> p.bestFriend);
```

Rather than use `var`, I explicitly typed out the type here, so we'd know immediately what was wrong. IntelliJ highlights this line as an error, and when we hover, we're greeted by this (surprisingly clear) error message.

```
Required type: Optional<Person>
Provided: Optional<Optional<Person>>
```

The value we return from the `map` method is placed inside of an optional for us. But, here, the value we return is _already an_ optional, so we're left with an optional of an optional. If we want to "flatten" this optional of an optional into just an optional, we use flatMap (just like we use in JavaScript when we want to flatten an array of arrays from `Array.map`)

```java
Optional<Person> personsBestFriend = personMaybe.flatMap(p -> p.bestFriend);
```

and of course we can use this optional now, as we did before

```java
personsBestFriend.ifPresentOrElse(s -> System.out.println(s.name), () -> System.out.println("No person"));
```

## Chaining things together

Rather than pulling the name off of the best friend, let's clean the code above up a bit, by extracting the best friend's name directly, and then using that. Let's also start to use function references more directly, to remove some of the bloat

```java
Optional<String> bestFriendsName = personMaybe.flatMap(Person::bestFriend).map(Person::name);
```

Which we can use as before

```java
bestFriendsName.ifPresentOrElse(System.out::println, () -> System.out.println("Nothing"));
```

As one final trick, let's note that Optionals have an orElse method. If you have an Optional<T>, the orElse takes a value (not an optional) of type T. If the optional had a value, that value is returned. If the optional was empty, the value you provided was returned. It's a good way to convert an optional, to a real value, while providing a default value if the optional was empty. Let's see it in action with the code above, grabbing our person's best friend's name (if there is one).

```java
String bestFriendsName = personMaybe.flatMap(Person::bestFriend).map(Person::name)
        .orElse("No friend found");
```

and now we can just use this string, which is guaranteed not to be null

```java
System.out.println(bestFriendsName);
```
