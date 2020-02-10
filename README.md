Weenie Framework
============================================================================

>
> **WARNING:** This framework is _highly experimental_ and is under active alpha development. It's
> not really meant to be used right now, although if you're curious and would like to try it out,
> you're free to do so. Read on, and be sure to check out `src/example.ts` for example usage
> (copied below for convenience).
>

The Weenie Framework is an experimental attempt at a microservices microframework for Typescript.

It was born out of a frustration with giganto-frameworks like Nest and a desire to keep things
small, light and composable, and with a special focus on empowering developers to build with it
whatever and however they wish _without the framework getting in the way._ While it's use case is
very different from that of Express, it is being designed and built with the same care not to take
strong opinions on anything.

To this end, Weenie was built like a cheap fake Christmas tree: It provides a central pole on which
you can hang just about anything. The idea is that each "branch" that you hang on the central pole
changes the definition of the pole for the branch that follows. It thus builds a dependency tree
where later dependencies may depend on earlier dependencies, and all current dependencies are both
known and strictly typed at each step.

What you hang on that dependency tree and what you do with it is entirely up to you. The example
in [`src/example.ts`](src/example.ts) is a decent look at what _I_ usually do with it and how.
That is, it demonstrates the deliberate building of a "resource bag" (a dependency injection
container), which I then use in event handlers and API request handlers to execute my core
logic.

And why go through all the trouble of doing it this way?

Frankly, this makes sense to me, and it makes each individual component much more narrowly scoped
and easier to test. Using this structure, I can mock out the entire tree for my test cases, and
I can easily encapsulate my application logic in functions that themselves have a very narrow set
of dependencies. And that allows me to focus my development and treat every component as it should
be treated - as a small, isolated unit that does one thing well and uses very few other things to
do it.

Here's `src/example.ts`, copied for convenience:

```ts
import {
  // Base framework function
  Weenie,

  // Config stuff (all of these actually come from the `weenie-base` package)
  configFromFiles,
  baseConfigValidator,
  databaseConfigValidator,
  webServiceConfigValidator,
  apiConfigValidator,

  // Functions that hang things on the tree
  logger,
  mysql,
  httpHandler,

  // Extra things for building the special api instantiator
  BaseApiDeps,
  ApiClient,
  ApiConfig,
} from "./";

// Runtypes for creating a final config validator
import * as rt from "runtypes";

// Some simple interfaces, used for creating our api clients (you might normally put these and the
// api client instantiation logic somewhere else, but it's all here to make the example more
// contained)
import {
  SimpleLoggerInterface,
  SimpleHttpClientInterface,
  SimpleSqlDbInterface,
} from "ts-simple-interfaces";


/**
 * Create final config definition
 *
 * Here, we're using the "base" config from weenie-base (which includes things like config for
 * an exponential backoff system, an initialization system, a logger, and environment awareness)
 * and we're adding config for a database, webservice provider, and two arbitrary API clients.
 *
 * This config contains all of the keys necessary to instantiate the rest of our dependencies.
 */
const exampleConfigValidator = rt.Intersect(
  baseConfigValidator,
  rt.Record({
    db: databaseConfigValidator,
    webservice: webServiceConfigValidator,
    firstApi: apiConfigValidator,
    secondApi: apiConfigValidator,
  })
);
declare type ExampleConfig = rt.Static<typeof exampleConfigValidator>;


/**
 * Build the application up as we see fit
 *
 * This is the meat of what we're doing. The `r` variable (short for `resources`) will emerge from
 * this as a full dependency injection container, with each dependency correctly instantiated and
 * typed.
 */

/**
 * We always start with onfig, since that's the foundation of everything. This returns the
 * following:
 *
 * { config: ExampleConfig }
 */
const r = Weenie(
  configFromFiles<ExampleConfig>(
    "./config.example.json",
    "./config.local.json",
    exampleConfigValidator
  )()
)

/**
 * Here we add the standard Weenie Logger. This is just a simple logger instance (winston-based)
 * with a specific configuration that is considered the "weenie" way.
 */
.and(logger)

/**
 * Next we do mysql. Nothing special here. Just a simple sql db instance specific to mysql.
 */
.and(mysql)

/**
 * Now we'll add our API clients. These we have to make kind of custom because it's impossible
 * to create a general function that provides both correct typing and access to the correct
 * configs without dangerous casting.
 *
 * To make it a little bit cleaner, Weenie provides the `BaseApiDeps` type, which defines an
 * environment-aware config and a logger. Then we just have to add our specific new config keys.
 */
.and((d: BaseApiDeps & { config: { firstApi: ApiConfig; secondApi: ApiConfig; } }) => {
  return {
    firstApi: new ApiClient({ envType: d.config.envType, ...d.config.firstApi }, d.logger),
    secondApi: new ApiClient({ envType: d.config.envType, ...d.config.secondApi }, d.logger),
  }
})

/**
 * For our IO abstraction, normally we would build this in a separate file and pull it in as a
 * module, but for this example, we'll just do it ad-hoc.
 *
 * The idea is to encapsulate all of the IO functionality we want to use here behind a defined,
 * declarative interface instead of doing raw queries, which are hard to stub out in testing.
 *
 * In this case, we're unifying both API calls and database calls into one abstraction.
 */
.and(
  (d: {
    logger: SimpleLoggerInterface,
    firstApi: SimpleHttpClientInterface,
    secondApi: SimpleHttpClientInterface,
    sql: SimpleSqlDbInterface
  }) => {
    return {
      io: {
        getAllDatabases: () => {
          return d.sql.query<{Database: string}>("SHOW DATABASES");
        },

        getTodo: async (todoId: number): Promise<Todo> => {
          const res = await d.firstApi.request<Todo>({ url: `/todos/${todoId}` });
          if (res.status >= 300) {
            throw new Error(
              `Received non 2xx status code from api call: ${JSON.stringify(res.data)}`
            );
          }
          return res.data;
        },

        getUser: async (userId: number): Promise<User> => {
          const res = await d.secondApi.request<User>({ url: `/users/${userId}` });
          if (res.status >= 300) {
            throw new Error(
              `Received non 2xx status code from api call: ${JSON.stringify(res.data)}`
            );
          }
          return res.data;
        },
      }
    }
  }
)

/**
 * Now we add an HTTP request handler to handle incoming requests.
 *
 * This function provides a very thinly-wrapped express app, which we'll configure with handlers
 * later on.
 */
.and(httpHandler)

/**
 * Finally, when we're done adding all our dependencies, we can define a final interface and
 * seal up the bag. The `done` method simply injects the dependencies that precede it and returns
 * whatever you choose to return. This becomes the final type of the `r` variable way up above,
 * and what we use to enact our application down below.
 */
.done((d) => {
  return {
    config: d.config,
    log: d.logger,
    io: d.io,
    http: d.http,
  }
});









/**
 * Now we can use our dependencies.
 *
 * In this case, we're just exercising them a little bit for the purposes of example. We're logging
 * stuff, exploring config values, getting information from the database, setting up an endpoint
 * for getting some info, and getting info from our APIs.
 */

r.log.notice(`App started in environment '${r.config.envName}'`);
r.io.getAllDatabases().then((result) => {
  r.log.notice(`Available databases:`);
  for (let row of result.rows) {
    r.log.notice(`* ${row.Database}`);
  }

  // Set up our webservice to handle incoming requests, and add middleware to log request info
  r.http.use((req, res, next) => { r.log.info(`Received request: ${req.path}`); next(); });
  r.http.get("/info", async (req, res, next) => {
    try {
      // Pick a random to-do and get info about it.
      const todoId = Math.round(Math.random() * 100);

      // Get todo
      r.log.info(`Getting todo id ${todoId} from API`);
      const todo = await r.io.getTodo(todoId)
      r.log.debug(`Got response from API: ${JSON.stringify(todo)}`);

      r.log.info(`Getting user id ${todo.userId} from API`);
      const user = await r.io.getUser(todo.userId);
      r.log.debug(`Got response from API: ${JSON.stringify(user)}`);

      res.send({
        timestamp: Date.now(),
        todo,
        user,
        meta: {
          nextTodo: todo.id*1 + 1,
          prevTodo: todo.id*1 - 1,
        }
      });
    } catch (e) {
      res.status(500).send({
        errors: [
          {
            title: "Sorry, we screwed up",
            detail: e.message
          }
        ]
      });
    }
  });

  // Start the app listening
  r.http.listen();
});











/**
 * Unimportant type definitions for the the example
 */
declare interface Todo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

declare interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  address: Address;
  phone: string;
  website: string;
  company: Company;
}

declare interface Address {
  street: string;
  suite: string;
  city: string;
  zipcode: string;
  geo: {
    lat: string;
    lng: string;
  }
}

declare interface Company {
  name: string;
  catchPhrase: string;
  bs: string;
}
```

This example is pretty trivial. However, it's very functional, and it demonstrates how easy it
would be to modify the framework. Have a standard DBAL that you like, you can just write a
function that hangs it on the tree configured the way you like it, and then any service that you
create, all you have to do is `.and(myDbal)`. Want a global cache? `.and` it in. Want an
exponential backer-offer? `.and` it in.

One of the interesting parts about this is that you can abstract whole parts of the tree away into
modules that represent you personal "way of doing things." For example, I could take the above and
wrap it into a `MyService` function, pass that to Weenie as a starting point and just start
`.and`ing from there.

Best of all, you can release lightweight functions that configure things in a useful way (logger
and config manager are ones that come mind as areas where people like to do things a variety of
different ways) and other people can incorprate those into _their_ microservices by just `.and`ing
them in.

## Future Development

There's a lot left to figure out from here. There's some basics, like adding a viable PubSub
setup to the standard framework functions, but there are also some tougher questions, like whether
and how to handle things like re-initializing dependencies on the fly when config changes (perhaps
via a permissioned endpoint or something).

For now, though, I'm letting my use-cases govern what gets built, and I invite any input from
anyone else who may be interested in this.

