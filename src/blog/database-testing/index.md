---
title: Testing database code with @testcontainers
date: "2026-10-05T10:00:00.000Z"
description: Introduction to @testcontainers as a way to unit test data access code
---

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

There's no sleight of hand here. I'm actually inserting that object graph into my multiple normalized tables, and then reconstructing it with that large join you saw before, and verifying that everything gets put back together.

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

## Wrapping up
