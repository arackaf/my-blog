---
title: Data access testing with @testcontainers
date: "2026-10-28T10:00:00.000Z"
description: Introduction to @testcontainers as a way to unit test database code
---

With AI writing the overwhelming majority of our code these days, testing and verification have never been more important. We probably all know how to write unit tests with something like Jest or Vitest, or even verify that our frontend code behaves correctly using something like RTL.

But writing tests against data access code has always been harder. Unit tests are supposed to be fast, and isolated; introducing an external database cuts against both of those goals.

Historically a common approach would be to have a test database, and, for each test, add a `try` block and begin a transaction with an isolation level that would allow you to read data which were not yet committed, inserted data, verify, and in the `finally` block, rollback the transaction. The downsides of this approach should be obvious. The complexity is high, as is the liklihood of different, concurrent tests interfering with each other while running on the same test database.

## Do you really need to unit test database code?

That's actually a very reasonable question, and the answer, as it often is, is "it depends." If your data access code is basic CRUD, inserting records and then reading them back, then no, you probably don't need to bother writing tests for code with such low complexity.

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

## Scaffolding our data

We want to run some tests against some complicated application queries, insertion logic, etc. We have a connection to an empty Postgres database in a Docker container. We need to get our tables and such set up. There's any number of ways to do this, but if you're using Drizzle, this can be especially easy.

`drizzle-kit` provides a seamless way to do database migrations. I wrote about `drizzle-kit` [here](https://blog.master.dev/drizzle-database-migrations/) so check that post out for a fuller introduction, but the short of it is, `drizzle-kit` push will send the database structure in my Drizzle objects over to a database. With just a little code, I can use that command to do this migration onto our Postgres database sitting in our container.

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function pushSchema(databaseUrl: string) {
  try {
    await execFileAsync("./node_modules/.bin/drizzle-kit", ["push", "--config=drizzle.config.ts", "--force"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        POSTGRES: databaseUrl,
      },
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
}
```

The key piece is here

```ts
POSTGRES: databaseUrl,
```

since my Drizzle config file reads the connection string from an environment variable of that name

```ts
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.POSTGRES!;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/drizzle/schema.ts",
  dbCredentials: {
    url: connectionString,
  },
  out: "./src/drizzle",
});
```

and so we can call it as simply as this

```ts
postgres = await new PostgreSqlContainer("postgres:18-alpine").start();

await pushSchema(postgres.getConnectionUri());
```

## Our use case

I've been tinkering with a fitness tracking application lately. The structure for storing workouts is fully normalized. An individual workout containers 1 or more segment. Each segment contains one or more exercise. And each exercise contains one or more measurement, for how many reps you did, with how much weight, etc.

The function for inserting a workout runs to almost 100 lines. Here's a small section of it

```ts
export const insertWorkout = async (db: DB, input: WorkoutState, userId: string) => {
  const exerciseIds = Array.from(new Set(input.segments.flatMap(segment => segment.exercises.map(exercise => exercise.exerciseId))));

  if (exerciseIds.length > 0) {
    const [mismatchedExercise] = await db
      .select({ securityCheckFailed: sql`0` })
      .from(exercisesTable)
      .where(
        exists(
          db
            .select({ id: exercisesTable.id })
            .from(exercisesTable)
            .where(and(inArray(exercisesTable.id, exerciseIds), not(eq(exercisesTable.userId, userId)))),
        ),
      );

    if (mismatchedExercise != null) {
      throw new Error("One or more exercises were not found.");
    }
  }

  if (input.workoutTemplateId != null) {
    const [template] = await db
      .select({ id: workoutTemplateTable.id })
      .from(workoutTemplateTable)
      .where(and(eq(workoutTemplateTable.id, input.workoutTemplateId), eq(workoutTemplateTable.userId, userId)));

    if (!template) {
      throw new Error(`Workout template ${input.workoutTemplateId} was not found.`);
    }
  }

  return db.transaction(async tx => {
    const [insertedWorkout] = await tx
      .insert(workoutTable)
      .values({
        // values ...
      })
      .returning({ id: workoutTable.id });

    for (const [segmentIndex, segment] of input.segments.entries()) {
      const [insertedSegment] = await tx
        .insert(workoutSegmentTable)
        .values({
          // values ...
        })
        .returning({ id: workoutSegmentTable.id });

      for (const [exerciseIndex, exercise] of segment.exercises.entries()) {
        const exerciseUnitValues = createExerciseUnitValues(exercise);

        const [insertedExercise] = await tx
          .insert(workoutSegmentExerciseTable)
          .values({
            // values ..
          })
          .returning({ id: workoutSegmentExerciseTable.id });

        const exerciseMeasurements = createExerciseMeasurements(exercise);
        if (exerciseMeasurements.length > 0) {
          await tx.insert(workoutSegmentExerciseMeasurementTable).values(
            exerciseMeasurements.map((measurement: (typeof exerciseMeasurements)[number]) => ({
              workoutSegmentExerciseId: insertedExercise.id,
              ...measurement,
            })),
          );
        }
      }
    }

    return insertedWorkout.id;
  });
};
```

And the method for querying a workout is equally complex, doing multiple joins, and then re-assembling the data.

```ts
export const getWorkouts = async (db: DB, options: GetWorkoutsOptions): Promise<WorkoutsPayload> => {
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const offset = (page - 1) * WORKOUT_HISTORY_LIMIT;

  const whereConditions: SQLWrapper[] = [eq(workoutTable.userId, options.userId)];
  if (options.id != null) {
    whereConditions.push(eq(workoutTable.id, options.id));
  }

  const workoutIds = db.$with("valid_workouts").as(
    db
      .select({
        workout_id: sql<number>`${workoutTable.id}`.as("workout_id"),
      })
      .from(workoutTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(workoutTable.workoutDate), desc(workoutTable.id))
      .limit(WORKOUT_HISTORY_QUERY_LIMIT)
      .offset(offset),
  );

  const rows = await db
    .with(workoutIds)
    .select({
      workoutId: workoutTable.id,
      workoutTemplateId: workoutTable.workoutTemplateId,
      workoutName: workoutTable.name,
      workoutDescription: workoutTable.description,
      workoutDate: workoutTable.workoutDate,
      segmentRowId: workoutSegmentTable.id,
      workoutTemplateSegmentId: workoutSegmentTable.workoutTemplateSegmentId,
      segmentOrder: workoutSegmentTable.segmentOrder,
      segmentSets: workoutSegmentTable.sets,
      exerciseRowId: workoutSegmentExerciseTable.id,
      workoutTemplateSegmentExerciseId: workoutSegmentExerciseTable.workoutTemplateSegmentExerciseId,
      exerciseOrder: workoutSegmentExerciseTable.exerciseOrder,
      exerciseExerciseId: workoutSegmentExerciseTable.exerciseId,
      exerciseExecutionType: workoutSegmentExerciseTable.executionType,
      exerciseDurationUnit: workoutSegmentExerciseTable.durationUnit,
      exerciseDistanceUnit: workoutSegmentExerciseTable.distanceUnit,
      exerciseWeightUnit: workoutSegmentExerciseTable.exerciseWeightUnit,
      measurementId: workoutSegmentExerciseMeasurementTable.id,
      workoutTemplateSegmentExerciseMeasurementId: workoutSegmentExerciseMeasurementTable.workoutTemplateSegmentExerciseMeasurementId,
      templateReps: workoutSegmentExerciseMeasurementTable.templateReps,
      templateRepsToFailure: workoutSegmentExerciseMeasurementTable.templateRepsToFailure,
      templateWeightUsed: workoutSegmentExerciseMeasurementTable.templateWeightUsed,
      templateDuration: workoutSegmentExerciseMeasurementTable.templateDuration,
      templateDistance: workoutSegmentExerciseMeasurementTable.templateDistance,
      measurementSetOrder: workoutSegmentExerciseMeasurementTable.setOrder,
      measurementReps: workoutSegmentExerciseMeasurementTable.reps,
      measurementWeightUsed: workoutSegmentExerciseMeasurementTable.weightUsed,
      measurementDuration: workoutSegmentExerciseMeasurementTable.duration,
      measurementDistance: workoutSegmentExerciseMeasurementTable.distance,
    })
    .from(workoutTable)
    .innerJoin(workoutIds, eq(workoutTable.id, workoutIds.workout_id))
    .leftJoin(workoutSegmentTable, eq(workoutSegmentTable.workoutId, workoutTable.id))
    .leftJoin(workoutSegmentExerciseTable, eq(workoutSegmentExerciseTable.workoutSegmentId, workoutSegmentTable.id))
    .leftJoin(
      workoutSegmentExerciseMeasurementTable,
      eq(workoutSegmentExerciseMeasurementTable.workoutSegmentExerciseId, workoutSegmentExerciseTable.id),
    )
    .orderBy(
      desc(workoutTable.workoutDate),
      desc(workoutTable.id),
      asc(workoutSegmentTable.segmentOrder),
      asc(workoutSegmentExerciseTable.exerciseOrder),
      asc(workoutSegmentExerciseMeasurementTable.setOrder),
    );

  // then loop and put it all back together
};
```

\*\*NOTE
A less normalized structure would certainly be simpler, but this approach allowes me to much more easily query workout progress for individual exercises and such.

## Writing our tests

We have our Postgres database ready, with our schema scaffolded. And we have our use case.

Let's write some code to insert some workouts, and then query it right back, and confirm everything matches. Getting data ready to insert into multiple tables is certainly a pain, but in this day and age we have AI agents to lean on for tedious, rote tasks like that. Here's what my process looked like.

I started with this

```ts
function createWorkout(name: string, date: string): WorkoutState {
  return {
    name,
    workoutDate: date,
  };
}
```

and then this quick dirty prompt

> ❯ Jump in @src/data/workouts/workouts.test.ts and see createWorkout

> Create a new type that is SegmentWithExercises but without segmentOrder or sets. Inside of it, the exercises array should be a new type that's WorkoutSegmentExerciseState but wityout exerciseOrder. Then inside that, use a new type for measurements that's WorkoutSegmentExerciseMeasurementState but without setOrder.

> When done, adjust createWorkout to also take an array of your new top-level type

> Start there and stop

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

Everything looked good to start, so I continued with this

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

and then

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

which is _almost_ what I wanted. I often prefer quick iterations like this, rather than meticulously trying to one-shot something.

> ❯ no sorry - take in the array and spit back out the mapped array

and finally I had what I wanted.

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

I made one or two small tweaks to what the model produced after seeing what I had, and what I wanted. Changes so small I just did them by hand. Here's the final version of my utilities, eliding the pieces which did not change.

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

And the test passes

![Test fails](/database-testing/img0-test-passes.jpg)

There's no sleight of hand here. I'm actually inserting that object graph into my multiple normalized tables using the same method my application code uses, and then reconstructing it back together, again with the same method my application uses, with that large join you saw before. And I'm verifying that everything gets put back together correctly.

A testing purist might argue that I'm doing too much in this test, that I should insert the workout and verify that the rows are in the right tables. And then a second test inserting those rows into the right tables, and then calling `getWorkouts` and verifying that they join and construct correctly. Honestly I prefer it this way. The test is less fragile. A change in database schema would not require any changes to this test. However the test is inserted, and read back is opaque to this test; it cares only that it comes back out in the same form it went in.

## Testing the test

To really, truly verify what I just said was true, I went ahead and changed this line in the query method (which puts the workout back together) from this

```ts
.leftJoin(workoutSegmentTable, eq(workoutSegmentTable.workoutId, workoutTable.id))
```

to this

```ts
.leftJoin(workoutSegmentTable, eq(workoutSegmentTable.workoutId, -1))
```

and lo and behold

![Test fails](/database-testing/img1-test-failure.jpg)

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

![Test fails](/database-testing/img2-test-failure-2.jpg)

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

![Test fails](/database-testing/img3-test-failure-3.jpg)

Anything which causes our object graph to not get read back out in the same structire we put it in will fail our test.

## These tests aren't free (or fast)

As you can see, the test suite takes over a second to setup and run; that's the container getting created. For complicated logic like you saw, that's time well spent in order to verify that everything works as you'd expect. But please don't abuse this tool and clutter your app with dozens or hundreds of trivial tests verifying trivial functionality.

## Wrapping up

Hopefully this post has shown you some useful tools you can use in your own projects, and at work to write meaningful tests for your data access code.

The `@testcontainers` package will get Docker running right inside your Vitest tests. Spin up an empty database, use your existing data access utilities to make sure things work exactly as expected. And remember, more tests is absolutely not always better. Test the meaningful parts of your application, with non-trivial logic. Tests which verify every single basic CRUD operation are unlikely to add much value, and are very likely to slow your test suite down to a crawl.

Happy coding!
