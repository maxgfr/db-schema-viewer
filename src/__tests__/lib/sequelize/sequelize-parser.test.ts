import { describe, it, expect } from "vitest";
import { parseSequelizeSchema } from "@/lib/sequelize/sequelize-parser";

describe("parseSequelizeSchema", () => {
  it("parses basic sequelize.define() with columns", () => {
    const content = `
      const { Sequelize, DataTypes } = require('sequelize');
      const sequelize = new Sequelize('sqlite::memory:');

      const User = sequelize.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          unique: true,
        },
      });
    `;
    const diagram = parseSequelizeSchema(content, "Test");

    expect(diagram.name).toBe("Test");
    expect(diagram.tables).toHaveLength(1);

    const user = diagram.tables[0]!;
    expect(user.name).toBe("User");
    expect(user.fields).toHaveLength(3);

    const idField = user.fields.find((f) => f.name === "id")!;
    expect(idField.primaryKey).toBe(true);
    expect(idField.type).toBe("INTEGER");
    expect(idField.nullable).toBe(false);

    const nameField = user.fields.find((f) => f.name === "name")!;
    expect(nameField.type).toBe("VARCHAR");
    expect(nameField.nullable).toBe(false);

    const emailField = user.fields.find((f) => f.name === "email")!;
    expect(emailField.unique).toBe(true);
  });

  it("parses Model.init() syntax", () => {
    const content = `
      const { Model, DataTypes } = require('sequelize');

      class User extends Model {}

      User.init({
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
      }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
      });
    `;
    const diagram = parseSequelizeSchema(content, "Init Test");

    expect(diagram.name).toBe("Init Test");
    expect(diagram.tables).toHaveLength(1);

    const user = diagram.tables[0]!;
    expect(user.name).toBe("users");
    expect(user.fields).toHaveLength(2);

    const idField = user.fields.find((f) => f.name === "id")!;
    expect(idField.primaryKey).toBe(true);

    const usernameField = user.fields.find((f) => f.name === "username")!;
    expect(usernameField.unique).toBe(true);
    expect(usernameField.nullable).toBe(false);
  });

  it("detects primaryKey, allowNull, unique", () => {
    const content = `
      const Product = sequelize.define('Product', {
        sku: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      });
    `;
    const diagram = parseSequelizeSchema(content);

    const product = diagram.tables[0]!;

    const skuField = product.fields.find((f) => f.name === "sku")!;
    expect(skuField.primaryKey).toBe(true);
    expect(skuField.unique).toBe(true);
    expect(skuField.nullable).toBe(false);

    const nameField = product.fields.find((f) => f.name === "name")!;
    expect(nameField.nullable).toBe(false);
    expect(nameField.unique).toBe(true);

    const descField = product.fields.find((f) => f.name === "description")!;
    expect(descField.nullable).toBe(true);
  });

  it("maps DataTypes to SQL types", () => {
    const content = `
      const AllTypes = sequelize.define('AllTypes', {
        str: { type: DataTypes.STRING },
        int: { type: DataTypes.INTEGER },
        bool: { type: DataTypes.BOOLEAN },
        date: { type: DataTypes.DATE },
        txt: { type: DataTypes.TEXT },
        flt: { type: DataTypes.FLOAT },
        dec: { type: DataTypes.DECIMAL },
        uid: { type: DataTypes.UUID },
        jsn: { type: DataTypes.JSON },
        enm: { type: DataTypes.ENUM('active', 'inactive') },
      });
    `;
    const diagram = parseSequelizeSchema(content);
    const table = diagram.tables[0]!;

    expect(table.fields.find((f) => f.name === "str")!.type).toBe("VARCHAR");
    expect(table.fields.find((f) => f.name === "int")!.type).toBe("INTEGER");
    expect(table.fields.find((f) => f.name === "bool")!.type).toBe("BOOLEAN");
    expect(table.fields.find((f) => f.name === "date")!.type).toBe("TIMESTAMP");
    expect(table.fields.find((f) => f.name === "txt")!.type).toBe("TEXT");
    expect(table.fields.find((f) => f.name === "flt")!.type).toBe("FLOAT");
    expect(table.fields.find((f) => f.name === "dec")!.type).toBe("DECIMAL");
    expect(table.fields.find((f) => f.name === "uid")!.type).toBe("UUID");
    expect(table.fields.find((f) => f.name === "jsn")!.type).toBe("JSON");
    expect(table.fields.find((f) => f.name === "enm")!.type).toBe(
      "ENUM('active', 'inactive')",
    );
  });

  it("parses references for FK relationships", () => {
    const content = `
      const User = sequelize.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        name: { type: DataTypes.STRING },
      });

      const Post = sequelize.define('Post', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        title: { type: DataTypes.STRING },
        authorId: {
          type: DataTypes.INTEGER,
          references: {
            model: 'User',
            key: 'id',
          },
        },
      });
    `;
    const diagram = parseSequelizeSchema(content);

    expect(diagram.tables).toHaveLength(2);

    const post = diagram.tables.find((t) => t.name === "Post")!;
    const authorField = post.fields.find((f) => f.name === "authorId")!;
    expect(authorField.isForeignKey).toBe(true);
    expect(authorField.references).toEqual({ table: "User", field: "id" });

    expect(diagram.relationships).toHaveLength(1);
    const rel = diagram.relationships[0]!;
    expect(rel.sourceTableId).toBe(post.id);

    const user = diagram.tables.find((t) => t.name === "User")!;
    expect(rel.targetTableId).toBe(user.id);
  });

  it("parses belongsTo and hasMany associations", () => {
    const content = `
      const User = sequelize.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        name: { type: DataTypes.STRING },
      });

      const Post = sequelize.define('Post', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        title: { type: DataTypes.STRING },
      });

      Post.belongsTo(User, { foreignKey: 'userId' });
      User.hasMany(Post, { foreignKey: 'userId' });
    `;
    const diagram = parseSequelizeSchema(content);

    expect(diagram.tables).toHaveLength(2);

    // belongsTo creates a relationship: Post.userId -> User.id
    // hasMany would create the same relationship (deduplicated)
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(1);

    const rel = diagram.relationships[0]!;
    const post = diagram.tables.find((t) => t.name === "Post")!;
    const user = diagram.tables.find((t) => t.name === "User")!;

    // The FK is on Post (source) pointing to User (target)
    expect(rel.sourceTableId).toBe(post.id);
    expect(rel.targetTableId).toBe(user.id);
    expect(rel.cardinality).toBe("one-to-many");
  });

  it("parses hasOne association", () => {
    const content = `
      const User = sequelize.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        name: { type: DataTypes.STRING },
      });

      const Profile = sequelize.define('Profile', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        bio: { type: DataTypes.TEXT },
      });

      User.hasOne(Profile, { foreignKey: 'userId' });
    `;
    const diagram = parseSequelizeSchema(content);

    expect(diagram.relationships).toHaveLength(1);
    const rel = diagram.relationships[0]!;

    const profile = diagram.tables.find((t) => t.name === "Profile")!;
    const user = diagram.tables.find((t) => t.name === "User")!;

    // hasOne: Profile.userId -> User.id
    expect(rel.sourceTableId).toBe(profile.id);
    expect(rel.targetTableId).toBe(user.id);
    expect(rel.cardinality).toBe("one-to-one");
  });

  it("parses belongsToMany association", () => {
    const content = `
      const Student = sequelize.define('Student', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        name: { type: DataTypes.STRING },
      });

      const Course = sequelize.define('Course', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        title: { type: DataTypes.STRING },
      });

      Student.belongsToMany(Course, { through: 'StudentCourses' });
    `;
    const diagram = parseSequelizeSchema(content);

    expect(diagram.relationships).toHaveLength(1);
    const rel = diagram.relationships[0]!;
    expect(rel.cardinality).toBe("many-to-many");
  });

  it("handles multiple models in one file", () => {
    const content = `
      const User = sequelize.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        name: { type: DataTypes.STRING },
        email: {
          type: DataTypes.STRING,
          unique: true,
        },
      });

      const Post = sequelize.define('Post', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        title: { type: DataTypes.STRING },
        body: { type: DataTypes.TEXT },
        userId: {
          type: DataTypes.INTEGER,
          references: {
            model: 'User',
            key: 'id',
          },
        },
      });

      const Comment = sequelize.define('Comment', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        text: { type: DataTypes.TEXT },
        postId: {
          type: DataTypes.INTEGER,
          references: {
            model: 'Post',
            key: 'id',
          },
        },
        userId: {
          type: DataTypes.INTEGER,
          references: {
            model: 'User',
            key: 'id',
          },
        },
      });
    `;
    const diagram = parseSequelizeSchema(content, "Blog");

    expect(diagram.name).toBe("Blog");
    expect(diagram.tables).toHaveLength(3);
    expect(diagram.tables.map((t) => t.name).sort()).toEqual([
      "Comment",
      "Post",
      "User",
    ]);

    // Comment has 2 FKs (postId, userId), Post has 1 FK (userId)
    expect(diagram.relationships).toHaveLength(3);
  });

  it("parses shorthand column syntax (DataTypes.X without block)", () => {
    const content = `
      const Tag = sequelize.define('Tag', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        name: DataTypes.STRING,
        active: DataTypes.BOOLEAN,
      });
    `;
    const diagram = parseSequelizeSchema(content);

    const tag = diagram.tables[0]!;
    expect(tag.fields).toHaveLength(3);

    const nameField = tag.fields.find((f) => f.name === "name")!;
    expect(nameField.type).toBe("VARCHAR");

    const activeField = tag.fields.find((f) => f.name === "active")!;
    expect(activeField.type).toBe("BOOLEAN");
  });

  it("parses defaultValue", () => {
    const content = `
      const Config = sequelize.define('Config', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        enabled: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        count: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
        },
        label: {
          type: DataTypes.STRING,
          defaultValue: 'untitled',
        },
      });
    `;
    const diagram = parseSequelizeSchema(content);

    const config = diagram.tables[0]!;

    const enabled = config.fields.find((f) => f.name === "enabled")!;
    expect(enabled.default).toBe("true");

    const count = config.fields.find((f) => f.name === "count")!;
    expect(count.default).toBe("0");

    const label = config.fields.find((f) => f.name === "label")!;
    expect(label.default).toBe("untitled");
  });

  it("handles empty/invalid input", () => {
    const diagram = parseSequelizeSchema("");
    expect(diagram.tables).toHaveLength(0);
    expect(diagram.relationships).toHaveLength(0);
    expect(diagram.name).toBe("Sequelize Schema");
    expect(diagram.databaseType).toBe("postgresql");
  });

  it("handles non-Sequelize JavaScript gracefully", () => {
    const content = `
      class Foo {
        bar() {
          return 42;
        }
      }
      const x = { name: "test" };
    `;
    const diagram = parseSequelizeSchema(content);
    expect(diagram.tables).toHaveLength(0);
    expect(diagram.relationships).toHaveLength(0);
  });

  it("generates unique IDs for all entities", () => {
    const content = `
      const User = sequelize.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        name: { type: DataTypes.STRING },
      });

      const Post = sequelize.define('Post', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        title: { type: DataTypes.STRING },
        userId: {
          type: DataTypes.INTEGER,
          references: {
            model: 'User',
            key: 'id',
          },
        },
      });
    `;
    const diagram = parseSequelizeSchema(content);

    const allIds = [
      diagram.id,
      ...diagram.tables.map((t) => t.id),
      ...diagram.tables.flatMap((t) => t.fields.map((f) => f.id)),
      ...diagram.relationships.map((r) => r.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it("uses modelName when tableName is not specified in init()", () => {
    const content = `
      class Task extends Model {}

      Task.init({
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        title: { type: DataTypes.STRING },
      }, {
        sequelize,
        modelName: 'tasks',
      });
    `;
    const diagram = parseSequelizeSchema(content);

    expect(diagram.tables).toHaveLength(1);
    expect(diagram.tables[0]!.name).toBe("tasks");
  });

  it("parses STRING with length argument", () => {
    const content = `
      const Item = sequelize.define('Item', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        code: {
          type: DataTypes.STRING(50),
        },
      });
    `;
    const diagram = parseSequelizeSchema(content);
    const item = diagram.tables[0]!;
    const code = item.fields.find((f) => f.name === "code")!;
    expect(code.type).toBe("VARCHAR(50)");
  });
});
