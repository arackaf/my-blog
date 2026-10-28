---
title: Data access testing with @testcontainers
date: "2026-10-28T10:00:00.000Z"
description: Introduction to @testcontainers as a way to unit test database code
---

With AI writing the overwhelming majority of our code these days, testing and verification have never been more important. We probably all know how to write unit tests with something like Jest or Vitest, or even verify that our frontend code behaves correctly using something like RTL.

But writing tests against data access code has always been harder. Unit tests are supposed to be fast, and isolated; introducing an external database cuts against both of those goals.

Historically a common approach would be to have a test database, and, for each test, add a `try` block and begin a transaction with an isolation level that would allow you to read data which were not yet committed, inserted data, verify, and in the `finally` block, rollback the transaction. The downsides of this approach should be obvious. The complexity is high, as is the liklihood of different, concurrent tests interfering with each other while running on the same test database.

## Do you really need to unit test database code?

That's actually a very reasonable question, and the answer is, as it often is, "it depends."

## Docker to the rescue

These days we have better options; we have Docker now. Docker allows us to spin up virtually anything within a completely isolated container, do what we wish, and then allow the container to vanish into the ether. And to help utilize Docker for this very use case, there's a nifty library called `@testcontainers`. There's a number of modules within that family, and for this post we'll be looking at `@testcontainers/postgresql`.

## Requirements

You'll need Docker running locally on your machine. Install (and start) Docker Desktop if it isn't already. If you're worried about CI/CD, don't. The container GitHub Actions run in includes Docker, so these tests will run just fine, there.

## Setting up our database

Setting up our database is as simple as this

```ts
const postgres = await new PostgreSqlContainer("postgres:18-alpine").start();
```

To get the url to that container, it's as simple as

```ts
postgres.getConnectionUri();
```

You'll probably want to access this object in both the `beforeAll` hook of your tests to set things up, as well as the `afterAll` hook, to tear it down. To declare this variable before assignment, without losing any typings, just lean on TypeScript a bit

```ts
let postgres: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
```

## Scaffolding our database

So you want to run some tests against some complicated application queries, insertion logic, etc.

## Leaning on our agents

Started here

```ts
function createWorkout(name: string, date: string): WorkoutState {
  return {
    name,
    workoutDate: date,
  };
}
```

and then with a quick and dirty prompt

> ❯ Jump in @src/data/workouts/workouts.test.ts and see createWorkout

Create a new type that is SegmentWithExercises but without segmentOrder or sets. Inside of it, the exercises array should be a new type that's WorkoutSegmentExerciseState but wityout exerciseOrder. Then inside that, use a new type for measurements that's WorkoutSegmentExerciseMeasurementState but without setOrder.

When done, adjust createWorkout to also take an array of your new top-level type

Start there and stop

And lo and behold

```ts
type TestMeasurement = Omit<WorkoutSegmentExerciseMeasurementState, "setOrder">;

type TestExercise = Omit<WorkoutSegmentExerciseState, "exerciseOrder" | "measurements"> & {
  measurements: TestMeasurement[];
};

type TestSegment = Omit<SegmentWithExercises, "segmentOrder" | "sets" | "exercises"> & {
  exercises: TestExercise[];
};

function createWorkout(name: string, date: string, segments: TestSegment[]): WorkoutState {
  return {
    name,
    workoutDate: date,
  };
}
```

Everything looks good, and so another quick and dirty prompt should have me in a good place

> ❯ cool now finish the function. Expand segments: TestSegment[] to the full type - use common sense in filling out details. segmentOrder should increment from 0, and so on. for sets: number, just reach down and get the length of measurements for the 0th exercise sent in (assume there'll always be at least 1)

And voilà

```ts
function createWorkout(name: string, date: string, segments: TestSegment[]): WorkoutState {
  return {
    name,
    workoutDate: date,
    segments: segments.map((segment, segmentIdx) => ({
      ...segment,
      segmentOrder: segmentIdx,
      sets: segment.exercises[0].measurements.length,
      exercises: segment.exercises.map((exercise, exerciseIdx) => ({
        ...exercise,
        exerciseOrder: exerciseIdx,
        measurements: exercise.measurements.map((measurement, measurementIdx) => ({
          ...measurement,
          setOrder: measurementIdx,
        })),
      })),
    })),
  };
}
```

and now one more prompt and we can get that logic usable in an actual test

> ❯ Now go in createWorkout and extract the mapping from TestSegment to SegmentWithExercises into a standalone function so I can reuse it elsewhere

```ts
function createWorkout(name: string, date: string, segments: TestSegment[]): WorkoutState {
  return {
    name,
    workoutDate: date,
    segments: segments.map(toSegmentWithExercises),
  };
}

function toSegmentWithExercises(segment: TestSegment, segmentIdx: number): SegmentWithExercises {
  return {
    ...segment,
    segmentOrder: segmentIdx,
    sets: segment.exercises[0].measurements.length,
    exercises: segment.exercises.map((exercise, exerciseIdx) => ({
      ...exercise,
      exerciseOrder: exerciseIdx,
      measurements: exercise.measurements.map((measurement, measurementIdx) => ({
        ...measurement,
        setOrder: measurementIdx,
      })),
    })),
  };
}
```

which is _almost_ what I wanted. Once more into the breach

> ❯ no sorry - take in the array and spit back out the mapped array

and finally we're in business

```ts
function createWorkout(name: string, date: string, segments: TestSegment[]): WorkoutState {
  return {
    name,
    workoutDate: date,
    segments: toSegmentsWithExercises(segments),
  };
}

function toSegmentsWithExercises(segments: TestSegment[]): SegmentWithExercises[] {
  return segments.map((segment, segmentIdx) => ({
    ...segment,
    segmentOrder: segmentIdx,
    sets: segment.exercises[0].measurements.length,
    exercises: segment.exercises.map((exercise, exerciseIdx) => ({
      ...exercise,
      exerciseOrder: exerciseIdx,
      measurements: exercise.measurements.map((measurement, measurementIdx) => ({
        ...measurement,
        setOrder: measurementIdx,
      })),
    })),
  }));
}
```

## Writing some actual tests

I made one or two small tweaks to what the model produced after seeing what I had, and what I wanted. Changes to small I just did them by hand. Here's the final version of my utilities, eliding the pieces which did not change.

```ts
type TestWorkoutState = Omit<WorkoutState, "segments"> & {
  segments: TestSegment[];
};

function createWorkout(workoutInput: TestWorkoutState): WorkoutState {
  return {
    name: workoutInput.name,
    workoutDate: workoutInput.workoutDate,
    segments: toSegmentsWithExercises(workoutInput.segments),
  };
}

function toSegmentsWithExercises(segments: TestSegment[]): SegmentWithExercises[] {
  return segments.map((segment, segmentIdx) => ({
    ...segment,
    segmentOrder: segmentIdx,
    sets: segment.exercises[0].measurements.length,
    exercises: segment.exercises.map((exercise, exerciseIdx) => ({
      ...exercise,
      exerciseOrder: exerciseIdx,
      measurements: exercise.measurements.map((measurement, measurementIdx) => ({
        ...measurement,
        setOrder: measurementIdx,
      })),
    })),
  }));
}
```

Again, I spent literally a few minutes generating them with the help of Claude Code.

And here's my first test

```ts
test("Insert simple workout with one exercise", async () => {
  const workoutInput: TestWorkoutState = {
    name: "Workout A",
    workoutDate: "10/06/2026",
    segments: [
      {
        exercises: [
          {
            exerciseId: benchPress.id!,
            measurements: [
              {
                weightUsed: 225,
                reps: 8,
              },
              {
                weightUsed: 225,
                reps: 7,
              },
              {
                weightUsed: 225,
                reps: 6,
              },
            ],
          },
        ],
      },
    ],
  };

  const workout = createWorkout(workoutInput);

  await insertWorkout(db, workout, userId);

  const result = await getWorkouts(db, { userId });

  expect(result.workouts[0]).toMatchObject(workoutInput);
});
```

There's no sleight of hand here. I'm actually inserting that object graph into my multiple normalized tables, and then reconstructing it with the same method my application uses, which performs that large join you saw before; and I'm verifying that everything gets put back together.

To really, truly verify what I just said was true, I went ahead and changed this line in the query method (which puts the workout back together) from this

```ts
.leftJoin(workoutSegmentTable, eq(workoutSegmentTable.workoutId, workoutTable.id))
```

to this

```ts
.leftJoin(workoutSegmentTable, eq(workoutSegmentTable.workoutId, -1))
```

and lo and behold

LINK IMAGE

The test fails.

And just for fun I'll revert that (verify the test passes again) and then break the insertion by changing this

```ts
for (const [segmentIndex, segment] of input.segments.entries()) {
  const [insertedSegment] = await tx
    .insert(workoutSegmentTable)
    .values({
      workoutId: insertedWorkout.id,
      workoutTemplateSegmentId: segment.workoutTemplateSegmentId,
      segmentOrder: segmentIndex + 1,
      sets: segment.sets,
    })
    .returning({ id: workoutSegmentTable.id });

  // ...
}
```

to this

```ts
for (const [segmentIndex, segment] of input.segments.entries()) {
  continue; // <---- HERE
  const [insertedSegment] = await tx
    .insert(workoutSegmentTable)
    .values({
      workoutId: insertedWorkout.id,
      workoutTemplateSegmentId: segment.workoutTemplateSegmentId,
      segmentOrder: segmentIndex + 1,
      sets: segment.sets,
    })
    .returning({ id: workoutSegmentTable.id });

  // ...
}
```

and again things don't read back correctly.

IMG 2

Obviously a bug that overt would probably be caught without tests; the point is, a more subtle bug you'd be less likely to even think of would be caught also.

At the risk of belaboring an obvious point, consider something as silly as ordering the measurement sets wrongly

```ts
.orderBy(
  desc(workoutTable.workoutDate),
  desc(workoutTable.id),
  asc(workoutSegmentTable.segmentOrder),
  asc(workoutSegmentExerciseTable.exerciseOrder),
  desc(workoutSegmentExerciseMeasurementTable.setOrder), // <------ should be desc
);
```

IMG

Anything which causes our object graph to not get read back out in the same structire we put it in will fail our test.

## Wrapping up

Hopefully this post has shown you some useful tools you can use in your own projects, and at work to write meaningful tests for your data access code.

The `@testcontainers` package will get Docker running right inside your Vitest tests. Spin up an empty database, use your existing data access utilities to make sure things work exactly as expected. And remember, more tests is absolutely not always better. Test the meaningful parts of your application, with non-trivial logic. Tests which verify every single basic CRUD operation are unlikely to add much value, and are very likely to slow your test suite down to a crawl.

Happy coding!
